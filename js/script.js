// Spotify API configuration
let code = '';
let accessToken = '';
let userPlaylists = [];
let allTracks = [];
let organizedTracks = {};

const REDIRECT_URI = "http://127.0.0.1:5500/index.html";
const SCOPES = 'playlist-read-private playlist-modify-private playlist-modify-public';
const CLIENT_SECRET = '18e8103ffc744320857132c22358a0a2';
const clientId = '8e25f9767f294500a665de6dfdaecc37';

// Tempo settings
let tempoRanges = {
    slow: { min: 0, max: 90 },
    medium: { min: 90, max: 130 },
    fast: { min: 130, max: 300 }
};

// Authentication functions
function login() {
    const Id = document.getElementById('clientId').value;
    if (!Id) {
        alert('Please enter your Spotify Client ID first!');
        return;
    }
    const params = new URLSearchParams({
        client_id: Id,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

function logout() {
    accessToken = '';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('user-section').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('testWarning').style.display = 'none';
    document.getElementById('preview-section').style.display = 'none';
}

// Check for access token in URL
async function checkForToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    accessToken = await getAccessToken(codeParam);
    if (codeParam) {
        code = codeParam;
        window.location.hash = ''; // Clear the hash
        loadUserProfile();
    }
}

// API functions

async function getAccessToken(code) {
    const response = await fetch("http://localhost:3001/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            code,
            redirectUri: REDIRECT_URI,
            clientId: clientId,
            clientSecret: CLIENT_SECRET
        })
    });

    const data = await response.json();
    return data.access_token;
}

async function apiCall(endpoint, options = {}) {
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
    }

    return response.json();
}

async function loadUserProfile() {
    try {
        const profile = await apiCall('/me');
        document.getElementById('username').textContent = profile.display_name;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('testWarning').style.display = 'block';
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load profile. Please try again.');
    }
}

async function loadPlaylists() {
    showStatus('Loading playlists...');
    try {
        let playlists = [];
        let offset = 0;
        let total = 0;

        do {
            const response = await apiCall(`/me/playlists?limit=50&offset=${offset}`);
            playlists = playlists.concat(response.items);
            total = response.total;
            offset += 50;
            updateProgress((offset / total) * 100);
        } while (offset < total);

        userPlaylists = playlists;
        displayPlaylists(playlists);
        document.getElementById('analyzeBtn').disabled = false;
        hideStatus();
    } catch (error) {
        console.error('Error loading playlists:', error);
        hideStatus();
        alert('Failed to load playlists. Please try again.');
    }
}

function displayPlaylists(playlists) {
    const container = document.getElementById('playlists-list');
    container.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>${playlists.length} playlists found</strong>
                </div>
            `;

    playlists.forEach(playlist => {
        const div = document.createElement('div');
        div.className = 'playlist-item';
        div.innerHTML = `
                    <div class="playlist-info">
                        <div class="playlist-name">${playlist.name}</div>
                        <div class="track-count">${playlist.tracks.total} tracks</div>
                    </div>
                `;
        container.appendChild(div);
    });
}

function updateRangeDisplay() {
    const slowMax = parseInt(document.getElementById('slowMax').value);
    const mediumMax = parseInt(document.getElementById('mediumMax').value);

    document.getElementById('slowMaxDisplay').textContent = `${slowMax} BPM`;
    document.getElementById('mediumMinDisplay').textContent = `${slowMax} BPM`;
    document.getElementById('mediumMaxDisplay').textContent = `${mediumMax} BPM`;
    document.getElementById('mediumMaxDisplay2').textContent = `${mediumMax} BPM`;
    document.getElementById('fastMinDisplay').textContent = `${mediumMax} BPM`;

    tempoRanges = {
        slow: { min: 0, max: slowMax },
        medium: { min: slowMax, max: mediumMax },
        fast: { min: mediumMax, max: 300 }
    };
}

async function analyzeMusic() {
    showStatus('Starting analysis...');

    try {
        // Load all tracks from all playlists
        await loadAllTracks();

        // Analyze and organize by tempo
        await analyzeByTempo();

        // Show preview
        displayPreview();

        hideStatus();
    } catch (error) {
        console.error('Error analyzing music:', error);
        hideStatus();
        alert('Failed to analyze music. Please try again.');
    }
}

async function loadAllTracks() {
    showStatus('Loading all tracks...');
    allTracks = [];
    let processedPlaylists = 0;

    for (const playlist of userPlaylists) {
        if (playlist.tracks.total > 0) {
            let offset = 0;
            let tracks = [];

            do {
                const response = await apiCall(`/playlists/${playlist.id}/tracks?limit=100&offset=${offset}`);
                const validTracks = response.items
                    .map(item => item.track)
                    .filter(track => track && track.id);
                tracks = tracks.concat(validTracks);
                offset += 100;
            } while (offset < playlist.tracks.total);

            allTracks = allTracks.concat(tracks);
        }

        processedPlaylists++;
        updateProgress((processedPlaylists / userPlaylists.length) * 40);
    }

    // Remove duplicates
    const uniqueTracks = [];
    const seenIds = new Set();

    for (const track of allTracks) {
        if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            uniqueTracks.push(track);
        }
    }

    allTracks = uniqueTracks;
    updateStatus(`Loaded ${allTracks.length} unique tracks`);
}

async function analyzeByTempo() {
    showStatus('Analyzing tempo...');
    organizedTracks = {
        'Slow Tempo (Chill & Ballads)': [],
        'Medium Tempo (Pop & Rock)': [],
        'Fast Tempo (Dance & Electronic)': []
    };

    // Get audio features for all tracks (in batches of 100)
    const audioFeatures = [];
    for (let i = 0; i < allTracks.length; i += 100) {
        const batch = allTracks.slice(i, i + 100);
        const ids = batch.map(track => track.id).join(',');
        try {
            const features = await apiCall(`/audio-features?ids=${ids}`);
            audioFeatures.push(...features.audio_features.filter(f => f !== null));
        } catch (error) {
            console.error('Error fetching audio features:', error);
        }
        updateProgress(40 + (i / allTracks.length) * 40);
    }

    // Create feature map
    const featureMap = {};
    audioFeatures.forEach(feature => {
        featureMap[feature.id] = feature;
    });

    // Organize by tempo
    allTracks.forEach(track => {
        const features = featureMap[track.id];
        if (!features) return;

        const tempo = features.tempo;
        const trackInfo = {
            name: track.name,
            artist: track.artists[0]?.name || 'Unknown',
            tempo: Math.round(tempo),
            id: track.id
        };

        if (tempo <= tempoRanges.slow.max) {
            organizedTracks['Slow Tempo (Chill & Ballads)'].push(trackInfo);
        } else if (tempo <= tempoRanges.medium.max) {
            organizedTracks['Medium Tempo (Pop & Rock)'].push(trackInfo);
        } else {
            organizedTracks['Fast Tempo (Dance & Electronic)'].push(trackInfo);
        }
    });

    // Sort each category by tempo
    Object.keys(organizedTracks).forEach(category => {
        organizedTracks[category].sort((a, b) => a.tempo - b.tempo);
    });

    updateProgress(100);
}

function displayPreview() {
    const previewContent = document.getElementById('preview-content');
    previewContent.innerHTML = '';

    Object.keys(organizedTracks).forEach(category => {
        const tracks = organizedTracks[category];
        if (tracks.length === 0) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'preview-category';

        let html = `<h4>${category} (${tracks.length} tracks)</h4>`;

        // Show first 10 tracks as preview
        const previewTracks = tracks.slice(0, 10);
        previewTracks.forEach(track => {
            html += `<div class="preview-track">♪ ${track.name} - ${track.artist} (${track.tempo} BPM)</div>`;
        });

        if (tracks.length > 10) {
            html += `<div class="preview-track" style="color: #1db954; font-style: italic;">...and ${tracks.length - 10} more tracks</div>`;
        }

        categoryDiv.innerHTML = html;
        previewContent.appendChild(categoryDiv);
    });

    document.getElementById('preview-section').style.display = 'block';
}

function cancelOrganization() {
    document.getElementById('preview-section').style.display = 'none';
    organizedTracks = {};
}

async function createPlaylists() {
    if (!confirm('This will create 3 new playlists on your Spotify account. Continue?')) {
        return;
    }

    showStatus('Creating playlists on Spotify...');
    document.getElementById('preview-section').style.display = 'none';

    try {
        const categories = Object.keys(organizedTracks);
        let processed = 0;

        for (const category of categories) {
            const tracks = organizedTracks[category];
            if (tracks.length === 0) continue;

            const playlistName = category;

            // Create playlist
            const playlist = await apiCall('/me/playlists', {
                method: 'POST',
                body: JSON.stringify({
                    name: playlistName,
                    description: `Automatically organized by tempo. Ranges: ${tempoRanges.slow.max} / ${tempoRanges.medium.max} BPM`,
                    public: false
                })
            });

            // Add tracks in batches of 100
            for (let i = 0; i < tracks.length; i += 100) {
                const batch = tracks.slice(i, i + 100);
                const uris = batch.map(track => `spotify:track:${track.id}`);

                await apiCall(`/playlists/${playlist.id}/tracks`, {
                    method: 'POST',
                    body: JSON.stringify({ uris })
                });
            }

            processed++;
            updateProgress((processed / categories.length) * 100);
            updateStatus(`Created "${playlistName}" with ${tracks.length} tracks`);
        }

        hideStatus();
        alert('✅ Success! Check your Spotify - 3 new tempo-organized playlists have been created!\n\nYour original playlists remain untouched.');

        // Refresh playlists
        loadPlaylists();

    } catch (error) {
        console.error('Error creating playlists:', error);
        hideStatus();
        alert('Failed to create playlists. Please try again.');
    }
}

// UI helper functions
function showStatus(message) {
    document.getElementById('status').classList.add('show');
    document.getElementById('status-text').textContent = message;
    updateProgress(0);
}

function hideStatus() {
    document.getElementById('status').classList.remove('show');
}

function updateStatus(message) {
    document.getElementById('status-text').textContent = message;
}

function updateProgress(percent) {
    document.getElementById('progress').style.width = `${percent}%`;
}

// Initialize app
checkForToken();
updateRangeDisplay();