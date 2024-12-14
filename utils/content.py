from datetime import datetime
from urllib.parse import urljoin
from flask import abort
import markdown
import logging
import yaml
import re
import os
import sys

logger = logging.getLogger(__name__)
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)


class DateSlugParser:
    def __init__(self):
        self.regex = re.compile(r'^(\d{4}-\d{2}-\d{2})')

    def __call__(self, slug):
        assert self.regex.match(slug)
        new_slug = slug[11:]  # remove date prefix
        date = datetime.strptime(slug[:10], '%Y-%m-%d').date()
        meta =  {'date': date}
        return new_slug, meta


class IDSlugParser:
    def __init__(self):
        self.regex = re.compile(r'^(\d+)-')

    def __call__(self, slug):
        assert self.regex.match(slug)
        id_, new_slug = slug.split('-', 1)
        meta = {'id': int(id_)}
        return new_slug, meta


class PageParser:
    def parse(self, body):
        meta, content = body.split('\n---\n', maxsplit=2)
        meta, content = meta.strip(), content.strip()
        content = self.parse_content(content)
        meta = self.parse_meta(meta)
        return meta, content

    def parse_meta(self, meta):
        meta = yaml.load(meta, yaml.SafeLoader)
        if type(meta) == str:
            meta = {}
        return meta

    def parse_content(self, content):
        return content


class MarkdownPageParser(PageParser):
    def __init__(self, extensions=None):
        if extensions is None:
            extensions = []
        self.extensions = extensions

    def parse_content(self, content):
        return markdown.markdown(content, extensions=self.extensions)


class ContentManager:
    def __init__(self, base_dir, url_prefix='', page_parser=None, slug_parser=None):
        self.base_dir = base_dir
        self.url_prefix = url_prefix
        self._page_index = {}
        self._pages = None

        if isinstance(slug_parser, type):
            slug_parser = slug_parser()

        self.page_parser = page_parser or PageParser()
        self.slug_parser = slug_parser

    def list(self):
        return self._pages

    def get(self, url):
        return self._page_index[url]

    def make_url(self, slug):
        return urljoin(self.url_prefix, slug) + '/'

    def reload(self):
        def _walker():
            for cur_path, dirnames, filenames in os.walk(self.base_dir):
                for basename in filenames:
                    yield os.path.join(cur_path, basename)

        logger.info('Reloading pages')
        self._pages = PageList(self._load_page(p) for p in _walker())
        self._page_index = {page['slug']: page for page in self._pages}

    def _load_page(self, fullpath):
        path_meta = self._meta_from_path(fullpath)
        old_page = self._page_index.get(path_meta['slug'])

        if old_page and old_page['modtime'] == path_meta['modtime']:
            logger.debug('Not modified: {}'.format(fullpath))
            return old_page

        with open(fullpath, 'r') as fp:
            raw_content = fp.read()
            logger.info('Loading page: {}'.format(path_meta['relpath']))
            page_meta, content = self.page_parser.parse(raw_content)

            meta = {}
            meta.update(path_meta)
            meta.update(page_meta)
            page = Page(raw_content, content, meta)

        return page

    def _meta_from_path(self, fullpath):
        modtime = datetime.fromtimestamp(os.path.getmtime(fullpath))
        relpath = os.path.relpath(fullpath, self.base_dir)
        basename = os.path.basename(fullpath)
        slug, extension = os.path.splitext(basename)

        meta = {
            'extension': extension,
            'fullpath': fullpath,
            'relpath': relpath,
            'modtime': modtime,
        }

        if self.slug_parser:
            slug, slug_meta = self.slug_parser(slug)
            meta.update(slug_meta)

        meta['url'] = self.make_url(slug)
        meta['slug'] = slug
        return meta


class FlaskContentManager(ContentManager):
    def __init__(self, app=None, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        self.app = app

        if app.debug and not os.environ.get('WERKZEUG_RUN_MAIN'):
            # http://stackoverflow.com/a/9476701/2912394
            # Prevent Flask initialize twice
            return

        if app.debug:
            app.before_request(self.reload_when_html_requested)

        self.reload()

    def reload_when_html_requested(self):
        from flask import request
        if request.path.startswith(self.app.static_url_path):
            return
        self.reload()

    def get_or_404(self, url):
        try:
            return self.get(url)
        except KeyError:
            raise abort(404)


class Page:
    def __init__(self, raw_content, content, meta):
        self.raw_content = raw_content
        self.content = content
        self._meta = meta

        # shortcuts for filtering
        self.url = meta['url']
        self.path = meta['relpath']

    def __getitem__(self, key):
        return self._meta[key]

    def __setitem__(self, key, val):
        self._meta[key] = val

    def get(self, key, default=None):
        return self._meta.get(key, default)

    @property
    def cut(self):
        parts = self.content.split('<!-- cut -->')
        return parts[0].strip()

    @property
    def tags(self):
        return set(self._meta.get('tags', []))


class PageList(list):
    def filter(self, func):
        items = filter(func, self)
        return self.__class__(items)

    def exclude(self, func):
        items = filter(lambda x: not func(x), self)
        return self.__class__(items)

    def order_by(self, key, reverse=False):
        if callable(key):
            items = sorted(self, key=key, reverse=reverse)
        else:
            if key.startswith('-'):
                reverse = True
                key = key[1:]
            items = sorted(self, key=lambda p: p[key], reverse=reverse)

        return self.__class__(items)


