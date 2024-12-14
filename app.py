from collections import OrderedDict
from datetime import datetime
import time
import os

from flask import Flask, Response, render_template, request
from flask_babel import Babel
import yaml

from utils.content import (
    FlaskContentManager,
    PageList,
    DateSlugParser,
    IDSlugParser,
    MarkdownPageParser,
)

DEBUG = bool(os.environ.get('FLASK_DEBUG'))
LANG = os.environ.get('SITE_LANG', 'en')
BASE_URL = os.getenv('BASE_URL', 'http://localhost:8000')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
BABEL_TRANSLATION_DIRECTORIES = os.path.join(BASE_DIR, 'locale')
BABEL_DEFAULT_TIMEZONE = 'UTC'
BABEL_DEFAULT_LOCALE = LANG
FREEZER_IGNORE_404_NOT_FOUND = True
FREEZER_STATIC_IGNORE = ['.DS_Store', 'Thumbs.db']
FREEZER_DESTINATION = os.path.join('build', LANG)

app = Flask(__name__)
app.config.from_mapping(locals())
babel = Babel(app)


def get_data():
    data = {}
    file_extensions = {'.yml', '.yaml'}
    dirname = os.path.join(DATA_DIR, LANG)

    if not os.path.isdir(dirname):
        return data

    for filename in os.listdir(dirname):
        name, ext = os.path.splitext(filename)
        if ext not in file_extensions:
            continue

        with open(os.path.join(dirname, filename)) as fp:
            data[name] = yaml.load(fp, yaml.SafeLoader)

    return data


class Content:
    data = get_data()

    blog = FlaskContentManager(
        app=app,
        url_prefix='/notes/',
        base_dir=os.path.join(BASE_DIR, 'notes', LANG),
        slug_parser=DateSlugParser(),
        page_parser=MarkdownPageParser([
            'markdown.extensions.attr_list',
        ]),
    )

    @classmethod
    def get_blog_posts(cls, tag=None):
        posts = cls.blog.list()

        def filter_post(post):
            return not post.get('redirect') and not post.get('hide')

        posts = posts.filter(filter_post)
        if tag is not None:
            posts = posts.filter(lambda post: tag in post.tags)
        return posts.order_by('-date')


def static_reidrect(url):
    return render_template('redirect.html', url=url)


@app.route('/')
def index():
    return render_template('index.html', posts=Content.get_blog_posts())

@app.route('/notes/')
def blog_index():
    return static_reidrect('/')


@app.route('/notes/<slug>/')
def blog_post(slug):
    post = Content.blog.get(slug)
    return render_template('post.html', post=post)


@app.route('/test/')
def typo_test():
    return render_template('test.html')


@app.template_filter()
def date_to_rfc822(value):
    # Wed, 02 Oct 2002 13:00:00 GMT
    return value.strftime('%a, %d %b %Y %H:%M:%S %z')


@app.context_processor
def inject_site():
    site = {
        'lang': LANG,
        'base_url': BASE_URL,
        'debug': bool(DEBUG),
        'time': datetime.now(),
        'timestamp': int(time.time()),
        'current_url': request.path,
    }
    site.update(Content.data)
    return {'site': site}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
