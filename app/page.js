"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const DEFAULT_PLAYLISTS = [
  { id: "playing", label: "Playing", color: "#06b6d4" },
  { id: "completed", label: "Completed", color: "#10b981" },
  { id: "backlog", label: "Backlog", color: "#f59e0b" },
  { id: "dropped", label: "Dropped", color: "#ef4444" },
];

export default function GameShelf() {
  // Auth state
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  // App state
  const [games, setGames] = useState([]);
  const [currentView, setCurrentView] = useState("home"); // "home" | "profile" | "playlist-[id]" | "errands"
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [playlists, setPlaylists] = useState(DEFAULT_PLAYLISTS);
  
  // Profile state
  const [profilePic, setProfilePic] = useState("https://ui-avatars.com/api/?name=User");
  const [gamerTags, setGamerTags] = useState({ xbox: "", psn: "", steam: "" });
  const [shareId, setShareId] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [gameToAdd, setGameToAdd] = useState(null); // Used for the category selection modal
  
  // Playlist Creation State
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editPlaylistName, setEditPlaylistName] = useState("");

  // Errands State (DB keeps 'tasks' as column name)
  const [activeTaskGame, setActiveTaskGame] = useState(null);
  const [newTaskInput, setNewTaskInput] = useState("");
  
  // Custom Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  // --- Initialization & Auth ---
  useEffect(() => {
    // Check system preference on initial load before user data comes in
    if (typeof window !== 'undefined') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        setIsDarkMode(true);
        document.body.classList.add("dark-mode");
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    setIsMounted(true);
    return () => subscription.unsubscribe();
  }, []);

  // --- Load User Data ---
  useEffect(() => {
    if (session) {
      loadUserData();
    } else {
      setGames([]);
    }
  }, [session]);

  const loadUserData = async () => {
    if (!session?.user) return;
    
    // Load Games
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (gamesData) setGames(gamesData);
    
    // Load Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileData) {
      if (profileData.theme) {
        setIsDarkMode(profileData.theme === 'dark');
        if (profileData.theme === 'dark') {
          document.body.classList.add("dark-mode");
        } else {
          document.body.classList.remove("dark-mode");
        }
      }
      if (profileData.profile_pic) {
        setProfilePic(profileData.profile_pic);
      }
      if (profileData.gamer_tags) {
        setGamerTags(profileData.gamer_tags);
      }
      if (profileData.share_id) {
        setShareId(profileData.share_id);
      }
      if (profileData.playlists && profileData.playlists.length > 0) {
        setPlaylists(profileData.playlists);
      }
    }
  };

  // --- Auth Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    const { error } = isLogin 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    const themeStr = newTheme ? 'dark' : 'light';
    
    if (newTheme) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    if (session?.user) {
      await supabase.from('profiles').update({ theme: themeStr }).eq('id', session.user.id);
    }
  };

  // Handle clicking outside search results and custom dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
      // Also close dropdown if clicking outside (simplified check for any click not on a dropdown button)
      if (!e.target.closest('.custom-dropdown-container')) {
          setOpenDropdownId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // --- Search Logic ---
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setShowSearchResults(true);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games?search=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (!res.ok) {
          console.error("Search API Error:", data.error);
          setSearchResults([]);
        } else {
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // Debounce
  };

  const initAddGame = (apiGame) => {
    if (games.some((g) => g.game_id === apiGame.id)) {
      alert("Game is already in your library!");
      return;
    }
    setGameToAdd(apiGame);
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const confirmAddGame = async (category) => {
    if (!gameToAdd) return;

    let imageUrl = null;
    if (gameToAdd.cover?.url) {
      imageUrl = gameToAdd.cover.url.startsWith('//') 
        ? `https:${gameToAdd.cover.url}`
        : gameToAdd.cover.url;
      imageUrl = imageUrl.replace('t_thumb', 't_cover_big');
    }
    
    let releaseYear = null;
    if (gameToAdd.first_release_date) {
        const date = new Date(gameToAdd.first_release_date * 1000);
        releaseYear = date.getFullYear();
    }

    const newGame = {
      user_id: session.user.id,
      game_id: gameToAdd.id,
      name: gameToAdd.name,
      image: imageUrl,
      category: category,
      release_year: releaseYear,
      tasks: []
    };

    const { data, error } = await supabase.from('games').insert([newGame]).select();

    if (!error && data) {
      setGames([...data, ...games]);
      setGameToAdd(null);
    } else {
      alert("Failed to add game");
    }
  };

  // --- Game Management ---
  const handleUpdateCategory = async (id, newCategory) => {
    if (newCategory === "delete") {
      const { error } = await supabase.from('games').delete().eq('id', id);
      if (!error) {
        setGames(games.filter((g) => g.id !== id));
      }
    } else {
      const { error } = await supabase.from('games').update({ category: newCategory }).eq('id', id);
      if (!error) {
        setGames(games.map((g) => g.id === id ? { ...g, category: newCategory } : g));
      }
    }
  };

  // --- Playlist Management ---
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
        setShowNewPlaylistInput(false);
        return;
    }
    const newId = newPlaylistName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    if (playlists.some(p => p.id === newId)) {
        alert("Playlist already exists!");
        return;
    }

    const updatedPlaylists = [...playlists, { id: newId, label: newPlaylistName.trim(), color: "#3b82f6" }]; // Default blue
    setPlaylists(updatedPlaylists);
    setNewPlaylistName("");
    setShowNewPlaylistInput(false);

    // Save to DB
    const { error } = await supabase.from('profiles').update({ playlists: updatedPlaylists }).eq('id', session.user.id);
    
    if (error) {
        console.error("Failed to save playlist:", error);
        alert(`Database Error: Could not save playlist. Did you run the SQL command to add the 'playlists' column to the 'profiles' table? Error: ${error.message}`);
        // Revert UI state if failed
        setPlaylists(playlists);
    }
  };

  const handleSaveEditPlaylist = async (id) => {
    if (!editPlaylistName.trim()) {
        setEditingPlaylistId(null);
        return;
    }
    const updatedPlaylists = playlists.map(p => p.id === id ? { ...p, label: editPlaylistName.trim() } : p);
    
    // Save to DB
    const { error } = await supabase.from('profiles').update({ playlists: updatedPlaylists }).eq('id', session.user.id);
    
    if (error) {
        console.error("Failed to update playlist:", error);
        alert(`Database Error: Could not update playlist.`);
    } else {
        setPlaylists(updatedPlaylists);
        setEditingPlaylistId(null);
    }
  };

  const handleDeletePlaylist = async (id) => {
    if (confirm("Are you sure you want to delete this playlist? Games in this playlist will remain, but the playlist category will be removed.")) {
        const updatedPlaylists = playlists.filter(p => p.id !== id);
        
        // Save to DB
        const { error } = await supabase.from('profiles').update({ playlists: updatedPlaylists }).eq('id', session.user.id);
        if (error) {
            console.error("Failed to delete playlist:", error);
            alert(`Database Error: Could not delete playlist.`);
        } else {
            setPlaylists(updatedPlaylists);
            setEditingPlaylistId(null);
            if (currentView === `playlist-${id}`) setCurrentView("home");
        }
    }
  };
  
  // --- Game Errands (Tasks) ---
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim() || !activeTaskGame) return;
    
    const newTask = {
        id: crypto.randomUUID(),
        text: newTaskInput.trim(),
        completed: false,
        created_at: new Date().toISOString()
    };
    
    const updatedTasks = [...(activeTaskGame.tasks || []), newTask];
    
    const { error } = await supabase.from('games').update({ tasks: updatedTasks }).eq('id', activeTaskGame.id);
    if (!error) {
        const updatedGame = { ...activeTaskGame, tasks: updatedTasks };
        setGames(games.map(g => g.id === activeTaskGame.id ? updatedGame : g));
        setActiveTaskGame(updatedGame);
        setNewTaskInput("");
    }
  };

  const handleToggleTask = async (taskId) => {
    if (!activeTaskGame) return;
    const updatedTasks = (activeTaskGame.tasks || []).map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    
    const { error } = await supabase.from('games').update({ tasks: updatedTasks }).eq('id', activeTaskGame.id);
    if (!error) {
        const updatedGame = { ...activeTaskGame, tasks: updatedTasks };
        setGames(games.map(g => g.id === activeTaskGame.id ? updatedGame : g));
        setActiveTaskGame(updatedGame);
    }
  };
  
  const handleDeleteTask = async (taskId) => {
    if (!activeTaskGame) return;
    const updatedTasks = (activeTaskGame.tasks || []).filter(t => t.id !== taskId);
    
    const { error } = await supabase.from('games').update({ tasks: updatedTasks }).eq('id', activeTaskGame.id);
    if (!error) {
        const updatedGame = { ...activeTaskGame, tasks: updatedTasks };
        setGames(games.map(g => g.id === activeTaskGame.id ? updatedGame : g));
        setActiveTaskGame(updatedGame);
    }
  };

  // Global Handlers for Dashboard
  const handleToggleGlobalTask = async (gameId, taskId) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    const updatedTasks = (game.tasks || []).map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const { error } = await supabase.from('games').update({ tasks: updatedTasks }).eq('id', game.id);
    if (!error) {
        setGames(games.map(g => g.id === game.id ? { ...g, tasks: updatedTasks } : g));
    }
  };

  const handleDeleteGlobalTask = async (gameId, taskId) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    const updatedTasks = (game.tasks || []).filter(t => t.id !== taskId);
    const { error } = await supabase.from('games').update({ tasks: updatedTasks }).eq('id', game.id);
    if (!error) {
        setGames(games.map(g => g.id === game.id ? { ...g, tasks: updatedTasks } : g));
    }
  };

  // --- Profile Picture & Settings ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && session?.user) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = async function() {
            // Resize image using canvas to save space
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG to save even more space
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            setProfilePic(dataUrl);
            const { error } = await supabase.from('profiles').update({ profile_pic: dataUrl }).eq('id', session.user.id);
            if (error) {
                console.error("Failed to save profile pic:", error);
                alert(`Could not save profile picture. You may need to run this SQL in Supabase: ALTER TABLE profiles ADD COLUMN profile_pic TEXT; (Error: ${error.message})`);
            }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    
    // Validate shareId format (alphanumeric, dashes, underscores)
    if (shareId && !/^[a-zA-Z0-9-_]+$/.test(shareId)) {
        alert("Share ID can only contain letters, numbers, dashes, and underscores.");
        setProfileSaving(false);
        return;
    }

    const updates = {
      gamer_tags: gamerTags,
      share_id: shareId || null, // null if empty so unique constraint doesn't break on multiple empty strings
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
    
    if (error) {
        if (error.code === '23505') { // Unique violation
            alert("That Share ID is already taken. Please choose another one.");
        } else {
            alert("Error saving profile: " + error.message);
        }
    } else {
        alert("Profile saved successfully!");
    }
    
    setProfileSaving(false);
  };


  if (!isMounted) return null;

  if (!session) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass" style={{ padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>GameShelf Login</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
              required
            />
            {authError && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{authError}</p>}
            <button type="submit" className="btn primary" disabled={authLoading}>
              {authLoading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
            <p style={{ textAlign: 'center', marginTop: '1rem', cursor: 'pointer', color: 'var(--accent-color)' }} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Determine what playlists to show in the main view
  let visiblePlaylists = [];
  if (currentView === "home") {
      visiblePlaylists = playlists;
  } else if (currentView.startsWith("playlist-")) {
      const playlistId = currentView.replace("playlist-", "");
      const found = playlists.find(p => p.id === playlistId);
      if (found) visiblePlaylists = [found];
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass">
        <div className="profile-section">
          <div className="profile-pic-container">
            <img 
                id="profile-pic"
                src={profilePic} 
                alt="Profile" 
            />
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <button 
              className="edit-pic-icon" 
              onClick={() => fileInputRef.current?.click()}
              style={{ zIndex: 2 }}
            >
              ✏️
            </button>
          </div>
          <h3 className="profile-name">
            {gamerTags.xbox || gamerTags.psn || gamerTags.steam || shareId || session.user.email.split('@')[0]}
          </h3>
        </div>
        
        <nav className="categories">
            <button 
              className={`category-btn ${currentView === "home" ? "active" : ""}`} 
              onClick={() => {
                setCurrentView("home");
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              🏠 Home
            </button>
            
            {/* Dynamic Playlist Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.5rem', marginBottom: '1rem', borderLeft: '2px solid var(--glass-border)', paddingLeft: '1rem', marginTop: '0.5rem' }}>
                {playlists.map(cat => {
                    const count = games.filter(g => g.category === cat.id).length;
                    
                    return (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center' }} className="playlist-item-wrapper">
                            <button 
                                className={`category-btn ${currentView === `playlist-${cat.id}` ? "active" : ""}`}
                                style={{ flexGrow: 1, fontSize: '0.9rem', padding: '0.5rem', opacity: currentView === `playlist-${cat.id}` ? 1 : 0.8, display: 'flex', justifyContent: 'space-between' }}
                                onClick={() => setCurrentView(`playlist-${cat.id}`)}
                            >
                                <span>{cat.label}</span>
                                <span style={{ background: 'var(--glass-border)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.75rem' }}>{count}</span>
                            </button>
                            <button 
                                className="edit-playlist-btn"
                                onClick={() => { setEditingPlaylistId(cat.id); setEditPlaylistName(cat.label); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1rem', marginLeft: '0.25rem', opacity: 0.5 }}
                                title="Edit Playlist"
                            >
                                ✏️
                            </button>
                        </div>
                    );
                })}
                
                {/* Add New Playlist */}
                {showNewPlaylistInput ? (
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Playlist name..."
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreatePlaylist();
                                if (e.key === 'Escape') {
                                    setShowNewPlaylistInput(false);
                                    setNewPlaylistName("");
                                }
                            }}
                            onBlur={handleCreatePlaylist}
                            style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                        />
                    </div>
                ) : (
                    <button 
                        className="category-btn"
                        style={{ fontSize: '0.85rem', padding: '0.5rem', opacity: 0.6, marginTop: '0.25rem', display: 'flex', justifyContent: 'center' }}
                        onClick={() => setShowNewPlaylistInput(true)}
                    >
                        + New Playlist
                    </button>
                )}
            </div>
            
            <button 
              className={`category-btn ${currentView === "errands" ? "active" : ""}`} 
              onClick={() => {
                setCurrentView("errands");
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              📝 Errands
            </button>

            <button 
              className={`category-btn ${currentView === "profile" ? "active" : ""}`} 
              onClick={() => setCurrentView("profile")}
            >
              👤 Profile
            </button>
        </nav>

        <div className="settings-section" style={{ marginTop: 'auto' }}>
          <button 
            className="btn outline"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        
        <header className="top-bar">
          <div className="search-container" ref={searchContainerRef}>
            <input 
              type="text" 
              id="game-search" 
              placeholder="Search for games to add..." 
              value={searchQuery}
              onChange={handleSearchInput}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowSearchResults(true);
              }}
            />
            
            {showSearchResults && (
              <div className="search-results glass">
                {isSearching ? (
                  <div style={{ padding: "1rem" }}>Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "1rem" }}>No games found.</div>
                ) : (
                  searchResults.map(game => {
                    let coverUrl = game.cover?.url ? (game.cover.url.startsWith('//') ? `https:${game.cover.url}` : game.cover.url) : "https://via.placeholder.com/50x70?text=No+Image";
                    
                    let yearStr = "Unknown";
                    if (game.first_release_date) {
                        const date = new Date(game.first_release_date * 1000);
                        yearStr = date.getFullYear().toString();
                    }

                    return (
                      <div 
                        key={game.id} 
                        className="search-item"
                        onClick={() => initAddGame(game)}
                      >
                        <img 
                          src={coverUrl} 
                          alt={game.name} 
                        />
                        <div className="search-item-info">
                          <span className="search-item-title">{game.name}</span>
                          <span className="search-item-year">{yearStr}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </header>

        {(currentView === "home" || currentView.startsWith("playlist-")) && (
          <div className="home-sections">
            {visiblePlaylists.map((cat) => {
                  const categoryGames = games.filter(g => g.category === cat.id);
                  
                  if (categoryGames.length === 0 && currentView === "home") return null;

                  return (
                    <section key={cat.id} id={`section-${cat.id}`} className="game-grid-container" style={{ scrollMarginTop: '80px' }}>
                      <h2 className="category-section-title">{cat.label}</h2>
                  
                  {categoryGames.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem' }}>
                          <p>This playlist is empty.</p>
                      </div>
                  ) : (
                    <div className="game-grid">
                        {categoryGames.sort((a, b) => (b.release_year || 0) - (a.release_year || 0)).map(game => {
                        const imgUrl = game.image || "https://via.placeholder.com/300x400?text=No+Image";
                        const generatedSlug = game.name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                        const ignSearchUrl = `https://www.ign.com/games/${generatedSlug}`;

                        return (
                            <div key={game.id} className="game-card-wrapper">
                                <div className="game-img-container">
                                    <button 
                                        className="remove-game-btn" 
                                        onClick={() => handleUpdateCategory(game.id, "delete")}
                                        title="Remove from shelf"
                                    >
                                        ×
                                    </button>
                                    <button 
                                        className="tasks-game-btn" 
                                        onClick={() => setActiveTaskGame(game)}
                                        title="View Errands"
                                    >
                                        📋
                                    </button>
                                    <img 
                                        className="game-img" 
                                        src={imgUrl} 
                                        alt={game.name} 
                                    />
                                    
                                    {/* Custom React Dropdown */}
                                    <div className="custom-dropdown-container">
                                        <button 
                                            className="custom-dropdown-button"
                                            style={{ background: playlists.find(p => p.id === game.category)?.color || '#3b82f6' }}
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setOpenDropdownId(openDropdownId === game.id ? null : game.id); 
                                            }}
                                        >
                                            {playlists.find(p => p.id === game.category)?.label || 'Playlist'}
                                            <span style={{fontSize: '0.6rem'}}>▼</span>
                                        </button>
                                        
                                        {openDropdownId === game.id && (
                                            <div className="custom-dropdown-menu">
                                                {playlists.map(p => (
                                                    <button 
                                                        key={p.id}
                                                        className="custom-dropdown-item"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            handleUpdateCategory(game.id, p.id); 
                                                            setOpenDropdownId(null); 
                                                        }}
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="game-title">{game.name}</div>
                                <a href={ignSearchUrl} target="_blank" rel="noopener noreferrer" className="ign-link-text">
                                    IGN Guide
                                </a>
                            </div>
                        );
                        })}
                    </div>
                  )}
                </section>
              );
            })}
            
            {games.length === 0 && currentView === "home" && (
              <div className="empty-state">
                <p>Your shelf is empty! Search for games above to add them.</p>
              </div>
            )}
          </div>
        )}

        {currentView === "errands" && (
            <div className="errands-dashboard-container" style={{padding: '0 2rem 2rem 2rem'}}>
                <h1 className="page-title" style={{marginBottom: '2rem'}}>Global Errands</h1>
                {games.filter(g => g.tasks && g.tasks.length > 0).length === 0 ? (
                    <div className="empty-state">
                        <p>You have no errands tracked for any games! Click the 📋 icon on a game card to add some.</p>
                    </div>
                ) : (
                    <div className="errands-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {games.filter(g => g.tasks && g.tasks.length > 0).map(game => (
                            <div key={game.id} className="glass" style={{padding: '1.5rem', borderRadius: '16px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem'}}>
                                    <img src={game.image || "https://via.placeholder.com/50"} alt={game.name} style={{width: '45px', height: '65px', borderRadius: '6px', objectFit: 'cover'}} />
                                    <h2 style={{margin: 0, fontSize: '1.25rem', lineHeight: 1.2}}>{game.name}</h2>
                                </div>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                                    {game.tasks.map(task => (
                                        <div key={task.id} className="errand-item">
                                            <label className="custom-checkbox-wrapper">
                                                <input 
                                                    type="checkbox" 
                                                    className="custom-checkbox-input"
                                                    checked={task.completed} 
                                                    onChange={() => handleToggleGlobalTask(game.id, task.id)}
                                                />
                                                <div className="custom-checkbox-box"></div>
                                            </label>
                                            <span style={{flexGrow: 1, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-secondary)' : 'white', wordBreak: 'break-word', fontSize: '0.95rem', lineHeight: 1.4}}>
                                                {task.text}
                                            </span>
                                            <button 
                                                onClick={() => handleDeleteGlobalTask(game.id, task.id)}
                                                style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.25rem', opacity: 0.7, marginTop: '-2px'}}
                                                onMouseEnter={(e) => e.target.style.opacity = 1}
                                                onMouseLeave={(e) => e.target.style.opacity = 0.7}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {currentView === "profile" && (
            <div className="profile-page-container">
                <h1 className="page-title">Profile Settings</h1>
                <div className="glass profile-form-card">
                    <form onSubmit={handleSaveProfile}>
                        <div className="form-group">
                            <label>Share ID (Custom URL)</label>
                            <div className="share-id-input-wrapper">
                                <span className="share-url-prefix">gameshelf.app/u/</span>
                                <input 
                                    type="text" 
                                    value={shareId} 
                                    onChange={(e) => setShareId(e.target.value)}
                                    placeholder="your-custom-id"
                                    className="form-control"
                                />
                            </div>
                            <small>Create a unique ID to share your shelf with friends.</small>
                        </div>
                        
                        <h3 className="section-subtitle">Gamer Tags</h3>
                        
                        <div className="form-group">
                            <label>Xbox Gamertag</label>
                            <input 
                                type="text" 
                                value={gamerTags.xbox || ""} 
                                onChange={(e) => setGamerTags({...gamerTags, xbox: e.target.value})}
                                placeholder="Enter Xbox Gamertag"
                                className="form-control"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>PlayStation Network ID</label>
                            <input 
                                type="text" 
                                value={gamerTags.psn || ""} 
                                onChange={(e) => setGamerTags({...gamerTags, psn: e.target.value})}
                                placeholder="Enter PSN ID"
                                className="form-control"
                            />
                        </div>

                        <div className="form-group">
                            <label>Steam ID / Username</label>
                            <input 
                                type="text" 
                                value={gamerTags.steam || ""} 
                                onChange={(e) => setGamerTags({...gamerTags, steam: e.target.value})}
                                placeholder="Enter Steam Username"
                                className="form-control"
                            />
                        </div>

                        <button type="submit" className="btn primary submit-profile-btn" disabled={profileSaving}>
                            {profileSaving ? "Saving..." : "Save Profile"}
                        </button>
                    </form>
                </div>
            </div>
        )}

      </main>

      {/* Category Selection Modal */}
      {gameToAdd && (
        <div className="modal">
          <div className="modal-content" style={{maxWidth: '450px'}}>
            <h2>Add to Shelf</h2>
            <p>Which playlist should <strong>{gameToAdd.name}</strong> go into?</p>
            <div className="category-modal-buttons">
                {playlists.map(cat => (
                    <button 
                        key={cat.id} 
                        className={`btn category-modal-btn`}
                        style={{
                            background: cat.color || '#3b82f6',
                            color: 'white',
                            marginBottom: '0.5rem',
                            width: '100%'
                        }}
                        onClick={() => confirmAddGame(cat.id)}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>
            <button className="btn outline" style={{marginTop: '1rem', width: '100%'}} onClick={() => setGameToAdd(null)}>
                Cancel
            </button>
          </div>
        </div>
      )}

      {/* Game Errands Modal */}
      {activeTaskGame && (
        <div className="modal">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h2 style={{margin: 0, fontSize: '1.5rem'}}>{activeTaskGame.name} Errands</h2>
                <button className="btn outline" style={{padding: '0.25rem 0.6rem', minWidth: 'auto', fontSize: '1.2rem', borderRadius: '50%'}} onClick={() => setActiveTaskGame(null)}>×</button>
            </div>
            
            <div className="tasks-list" style={{maxHeight: '350px', overflowY: 'auto', marginBottom: '1.5rem', textAlign: 'left', paddingRight: '0.5rem'}}>
                {(!activeTaskGame.tasks || activeTaskGame.tasks.length === 0) ? (
                    <p style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 1rem'}}>No errands added yet. Create one below!</p>
                ) : (
                    activeTaskGame.tasks.map(task => (
                        <div key={task.id} className="errand-item">
                            <label className="custom-checkbox-wrapper">
                                <input 
                                    type="checkbox" 
                                    className="custom-checkbox-input"
                                    checked={task.completed} 
                                    onChange={() => handleToggleTask(task.id)}
                                />
                                <div className="custom-checkbox-box"></div>
                            </label>
                            <span style={{flexGrow: 1, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-secondary)' : 'white', wordBreak: 'break-word', fontSize: '1rem', lineHeight: 1.4}}>
                                {task.text}
                            </span>
                            <button 
                                onClick={() => handleDeleteTask(task.id)}
                                style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.5rem', padding: '0 0.25rem', opacity: 0.7, marginTop: '-4px'}}
                                onMouseEnter={(e) => e.target.style.opacity = 1}
                                onMouseLeave={(e) => e.target.style.opacity = 0.7}
                            >
                                ×
                            </button>
                        </div>
                    ))
                )}
            </div>
            
            <form onSubmit={handleAddTask} style={{display: 'flex', gap: '0.75rem'}}>
                <input 
                    type="text" 
                    placeholder="E.g. Collect all 100 feathers..." 
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    className="form-control"
                    style={{flexGrow: 1, padding: '0.85rem', fontSize: '1rem'}}
                />
                <button type="submit" className="btn primary" disabled={!newTaskInput.trim()} style={{padding: '0 1.5rem', fontWeight: 600}}>
                    Add Errand
                </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {editingPlaylistId && (
        <div className="modal">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2 style={{marginBottom: '1.5rem'}}>Edit Playlist</h2>
            
            <input 
                type="text" 
                value={editPlaylistName}
                onChange={(e) => setEditPlaylistName(e.target.value)}
                className="form-control"
                style={{marginBottom: '1.5rem', width: '100%'}}
                autoFocus
                placeholder="Playlist name"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEditPlaylist(editingPlaylistId);
                    if (e.key === 'Escape') setEditingPlaylistId(null);
                }}
            />
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                <button 
                    className="btn primary" 
                    onClick={() => handleSaveEditPlaylist(editingPlaylistId)}
                    style={{width: '100%', padding: '0.85rem', fontWeight: 600}}
                >
                    Save Changes
                </button>
                <button 
                    className="btn outline" 
                    onClick={() => setEditingPlaylistId(null)}
                    style={{width: '100%', padding: '0.85rem', fontWeight: 600}}
                >
                    Cancel
                </button>
                <button 
                    className="btn outline" 
                    onClick={() => handleDeletePlaylist(editingPlaylistId)}
                    style={{width: '100%', borderColor: '#ef4444', color: '#ef4444', marginTop: '1rem', padding: '0.85rem', fontWeight: 600}}
                >
                    Delete Playlist
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
