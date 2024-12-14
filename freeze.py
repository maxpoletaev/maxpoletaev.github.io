from app import LANG, app, Content
from flask_frozen import Freezer
import os


class CustomFreezer(Freezer):
    def urlpath_to_filepath(self, path):
        _, ext = os.path.splitext(path)

        if path.endswith('/'):
            path += 'index.html'
        elif not ext:
            path += '.html'

        # Remove the initial slash that should always be there
        assert path.startswith('/')
        return path[1:]


freezer = CustomFreezer(app)

@freezer.register_generator
def blog_post():
    for post in Content.get_blog_posts():
        yield {'slug': post['slug']}


if __name__ == '__main__':
    freezer.freeze()
