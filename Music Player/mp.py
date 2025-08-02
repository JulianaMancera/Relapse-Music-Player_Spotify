from flask import Flask, request, redirect, jsonify
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import os

app = Flask(__name__, static_folder='.', static_url_path='')

# Spotify API credentials
load_dotenv()  # Load variables from .env file

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI')
SCOPE = 'user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state user-library-read'

sp_oauth = SpotifyOAuth(
    client_id=SPOTIFY_CLIENT_ID,
    client_secret=SPOTIFY_CLIENT_SECRET,
    redirect_uri=SPOTIFY_REDIRECT_URI,
    scope=SCOPE
)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/styles.css')
def serve_css():
    return app.send_static_file('styles.css')

@app.route('/script.js')
def serve_js():
    return app.send_static_file('script.js')

@app.route('/login')
def login():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    access_token = token_info['access_token']
    return redirect(f'/?token={access_token}')

@app.route('/saved-tracks')
async def get_saved_tracks():
    sp = spotipy.Spotify(auth=request.args.get('token'))
    tracks = []
    offset = 0
    limit = 50
    while True:
        results = sp.current_user_saved_tracks(limit=limit, offset=offset)
        tracks.extend(results['items'])
        if len(results['items']) < limit:
            break
        offset += limit
    return jsonify(tracks)

@app.route('/search')
def search():
    sp = spotipy.Spotify(auth=request.args.get('token'))
    query = request.args.get('query')
    results = sp.search(q=query, type='track', limit=10)
    return jsonify(results)

@app.route('/play', methods=['POST'])
def play():
    sp = spotipy.Spotify(auth=request.args.get('token'))
    data = request.get_json()
    sp.start_playback(uris=[data['uri']])
    return jsonify({'status': 'success'})

@app.route('/transfer-playback', methods=['POST'])
def transfer_playback():
    sp = spotipy.Spotify(auth=request.args.get('token'))
    data = request.get_json()
    sp.transfer_playback(device_id=data['device_id'], force_play=True)
    return jsonify({'status': 'success'})

@app.route('/lyrics')
def lyrics():
    return jsonify({'lyrics': 'Lyrics API integration required'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)