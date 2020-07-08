from flask import Flask
app = Flask(__name__, static_folder='../static', static_url_path='/static')

@app.route('/')
def root():
    return app.send_static_file('html/index.html')