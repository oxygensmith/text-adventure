from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    # Serve the main HTML file that includes your JavaScript game logic
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)