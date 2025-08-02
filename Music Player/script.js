let player;
let isPlaying = false;
const playPauseBtn = document.getElementById('play-pause-btn');
const nowPlaying = document.getElementById('now-playing');
const progressBar = document.getElementById('progress');
const volumeSlider = document.getElementById('volume-slider');
const songList = document.getElementById('song-list');
const toggleLibraryBtn = document.getElementById('toggle-library');
const searchSection = document.getElementById('search-section');
const toggleSearchBtn = document.getElementById('toggle-search');
const lyricsPanel = document.getElementById('lyrics-panel');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const library = document.getElementById('library');

// Spotify Web Playback SDK
window.onSpotifyWebPlaybackSDKReady = () => {
    const token = new URLSearchParams(window.location.search).get('token');
    player = new Spotify.Player({
        name: 'Pixel Relapse Music Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        fetch('/transfer-playback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id })
        });
    });

    player.addListener('player_state_changed', state => {
        if (state) {
            isPlaying = !state.paused;
            playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
            nowPlaying.textContent = state.track_window.current_track
                ? `${state.track_window.current_track.name} - ${state.track_window.current_track.artists[0].name}`
                : 'No track playing';
            updateProgress(state.position, state.duration);
        }
    });

    player.connect();
};

function updateProgress(position, duration) {
    const progressPercent = (position / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
}

function startPlayer() {
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('player').classList.remove('hidden');
    initWebcam();
    fetchAllSavedTracks();
}

playPauseBtn.addEventListener('click', () => {
    player.togglePlay();
});

document.getElementById('prev-btn').addEventListener('click', () => {
    player.previousTrack();
});

document.getElementById('next-btn').addEventListener('click', () => {
    player.nextTrack();
});

volumeSlider.addEventListener('input', () => {
    player.setVolume(volumeSlider.value / 100);
});

toggleLibraryBtn.addEventListener('click', () => {
    library.classList.toggle('hidden');
    searchSection.classList.add('hidden');
    if (!library.classList.contains('hidden')) {
        fetchAllSavedTracks();
    }
});

toggleSearchBtn.addEventListener('click', () => {
    searchSection.classList.toggle('hidden');
    library.classList.add('hidden');
    if (!searchSection.classList.contains('hidden')) {
        searchResults.innerHTML = '';
    }
});

searchBtn.addEventListener('click', () => {
    const query = searchInput.value;
    if (query) {
        fetch(`/search?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                searchResults.innerHTML = '';
                data.tracks.items.forEach(track => {
                    const div = document.createElement('div');
                    div.textContent = `${track.name} - ${track.artists[0].name}`;
                    div.classList.add('cursor-pointer', 'p-2', 'hover:bg-gray-600');
                    div.addEventListener('click', () => {
                        fetch('/play', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uri: track.uri })
                        });
                    });
                    searchResults.appendChild(div);
                });
            });
    }
});

async function fetchAllSavedTracks() {
    songList.innerHTML = 'Loading...';
    const tracks = await fetch('/saved-tracks').then(res => res.json());
    songList.innerHTML = '';
    tracks.forEach(item => {
        const track = item.track;
        const div = document.createElement('div');
        div.textContent = `${track.name} - ${track.artists[0].name}`;
        div.classList.add('cursor-pointer', 'p-2', 'hover:bg-gray-600');
        div.addEventListener('click', () => {
            fetch('/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uri: track.uri })
            });
        });
        songList.appendChild(div);
    });
}

function fetchLyrics() {
    fetch('/lyrics')
        .then(response => response.json())
        .then(data => {
            lyricsPanel.textContent = data.lyrics || 'No lyrics available';
        })
        .catch(() => {
            lyricsPanel.textContent = 'Lyrics not found';
        });
}

// MediaPipe Hand Gesture Recognition
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
let lastGestureTime = 0;

function initWebcam() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            videoElement.srcObject = stream;
            videoElement.play();
        });
}

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onHandResults);

function onHandResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            const now = Date.now();
            if (now - lastGestureTime < 1000) return;

            const wrist = landmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            const thumbIndexDist = Math.hypot(
                thumbTip.x - indexTip.x,
                thumbTip.y - indexTip.y
            );

            if (thumbIndexDist < 0.05) {
                player.togglePlay();
                lastGestureTime = now;
            } else if (indexTip.x > wrist.x + 0.2) {
                player.nextTrack();
                lastGestureTime = now;
            } else if (indexTip.x < wrist.x - 0.2) {
                player.previousTrack();
                lastGestureTime = now;
            }
        }
    }
    canvasCtx.restore();
}

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
camera.start();