// 1. This runs immediately when the page loads to secure the Lobby state
if (location.hash === "" || location.hash === "#room") {
    history.replaceState({ inRoom: false }, "", "#");
}

// 2. Updated join success handler
socket.on('join success', (data) => {
    document.getElementById("lobby-container").classList.add("hidden");
    document.getElementById("cinema-container").classList.remove("hidden");
    
    // Push the room state into history
    history.pushState({ inRoom: true }, "", "#room");

    const urlToLoad = data.videoUrl || initialVideoUrl;
    if (urlToLoad) {
        loadVideoSource(urlToLoad);
    }
});

// 3. Handle the back button click correctly
window.addEventListener('popstate', (event) => {
    // If we went back and we are no longer in the room state
    document.getElementById("cinema-container").classList.add("hidden");
    document.getElementById("lobby-container").classList.remove("hidden");
    
    if (typeof toggleCinemaMode === "function" && document.body.classList.contains("cinema-mode-active")) {
        toggleCinemaMode(true);
    }
    
    if (typeof hideAllPlayers === "function") {
        hideAllPlayers();
    }
});