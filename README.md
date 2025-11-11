# 🎵 SPOTIFY PLAYLIST ORGANIZER

## Overview
A web application built using Node.js and Express to interact with the Spotify Web API. This tool allows users to connect their Spotify account and organize their playlists based on custom criteria.

## 🛠️ Setup and Installation

### Prerequisites
* Node.js (v18 or higher recommended)
* A Spotify Developer Account with a registered application.

### Installation Steps

1.  **Clone the Repository:**
    ```bash
    git clone [YOUR REPO URL HERE]
    cd spotify-playlist-organizer
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a file named `.env` in the root directory and add your application credentials:
    ```
    SPOTIFY_CLIENT_ID=YOUR_CLIENT_ID
    SPOTIFY_CLIENT_SECRET=YOUR_CLIENT_SECRET
    SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
    ```

4.  **Run the Server:**
    ```bash
    node server.js
    ```
    The application should start on `http://localhost:8888`.

## 📌 Usage
[Describe how a user would interact with your application here.]