"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const DEFAULT_PLAYLISTS = [
  { id: "playing", label: "Playing", color: "#06b6d4" },
  { id: "completed", label: "Completed", color: "#10b981" },
  { id: "backlog", label: "Backlog", color: "#f59e0b" },
  { id: "dropped", label: "Dropped", color: "#ef4444" },
];

const FILTER_GENRES = [
  { id: 12, label: "RPG" },
  { id: 5, label: "Shooter" },
  { id: 31, label: "Action" },
  { id: 15, label: "Strategy" },
  { id: 13, label: "Simulation" },
  { id: 14, label: "Sports" },
  { id: 10, label: "Racing" },
  { id: 9, label: "Puzzle" },
  { id: 33, label: "Arcade" },
  { id: 8, label: "Platform" }
];

export default function GameShelf() {
  // Auth state
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [activeTaskGame, setActiveTaskGame] = useState(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [selectedGameDetails, setSelectedGameDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // App state
  const [games, setGames] = useState([]);
  const [currentView, setCurrentView] = useState("home"); // "home" | "profile" | "playlist-[id]" | "errands"
  const [currentTheme, setCurrentTheme] = useState("theme-glass");
  const [playlists, setPlaylists] = useState(DEFAULT_PLAYLISTS);
  
  // Profile state
  const [profilePic, setProfilePic] = useState("https://ui-avatars.com/api/?name=User");
  const [gamerTags, setGamerTags] = useState({ xbox: "", psn: "", steam: "" });
  const [shareId, setShareId] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Recommendation state
  const [recommendedGame, setRecommendedGame] = useState(null);
  const [isRecommending, setIsRecommending] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [gameToAdd, setGameToAdd] = useState(null); // Used for the category selection modal
  const [searchGenres, setSearchGenres] = useState([]);
  const [searchYearStart, setSearchYearStart] = useState("");
  const [searchYearEnd, setSearchYearEnd] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Playlist Creation State
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editPlaylistName, setEditPlaylistName] = useState("");

  // Errands State (DB keeps 'tasks' as column name)
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentTheme("theme-glass-dark");
        document.body.className = "theme-glass-dark";
      } else {
        document.body.className = "theme-glass";
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
  const loadUserData = useCallback(async () => {
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
        setCurrentTheme(profileData.theme);
        document.body.className = profileData.theme;
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
  }, [session?.user]);

  useEffect(() => {
    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUserData();
    } else {
      setGames([]);
    }
  }, [session, loadUserData]);

  // --- Auth Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        // If the user tries to sign up but the account already exists,
        // automatically try to log them in instead!
        if (error.message === "User already registered") {
          const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
          if (loginError) {
            setAuthError("Account exists, but password was incorrect: " + loginError.message);
          }
        } else {
          setAuthError(error.message);
        }
      }
    }

    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const THEMES = [
    { id: "theme-glass", label: "Light" },
    { id: "theme-glass-dark", label: "Dark" },
    { id: "theme-retro", label: "Retro" }
  ];

  const handleThemeChange = async (themeStr) => {
    setCurrentTheme(themeStr);
    document.body.className = themeStr;

    if (session?.user) {
      await supabase.from('profiles').upsert({ id: session.user.id, theme: themeStr });
    }
  };

  const cycleTheme = () => {
    const currentIndex = THEMES.findIndex(t => t.id === currentTheme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    handleThemeChange(THEMES[nextIndex].id);
  };

  // Handle clicking outside search results and custom dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
      // Also close dropdown if clicking outside (simplified check for any click not on a dropdown button)
      if (!e.target.closest('.custom-dropdown-container') && !e.target.closest('.mobile-playlist-trigger')) {
          setOpenDropdownId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // --- Search Logic ---
  const triggerSearch = (query, genres, startYear, endYear) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const hasFilters = genres.length > 0 || startYear || endYear;
    if (query.trim().length < 2 && !hasFilters) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setShowSearchResults(true);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let url = `/api/games?search=${encodeURIComponent(query)}`;
        if (genres.length > 0) url += `&genres=${genres.join(',')}`;
        if (startYear) url += `&startYear=${startYear}`;
        if (endYear) url += `&endYear=${endYear}`;

        const res = await fetch(url);
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

  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    triggerSearch(query, searchGenres, searchYearStart, searchYearEnd);
  };

  const toggleGenre = (genreId) => {
    setSearchGenres(prev => {
        const newGenres = prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId];
        triggerSearch(searchQuery, newGenres, searchYearStart, searchYearEnd);
        return newGenres;
    });
  };

  const handleYearChange = (type, value) => {
      if (type === 'start') {
          setSearchYearStart(value);
          triggerSearch(searchQuery, searchGenres, value, searchYearEnd);
      } else {
          setSearchYearEnd(value);
          triggerSearch(searchQuery, searchGenres, searchYearStart, value);
      }
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



  const handleRecommendGame = async () => {
    if (games.length === 0) {
      alert("Add some games first to get recommendations!");
      return;
    }
    
    setIsLoadingRecs(true);
    setRecommendedGame(null);
    try {
        const res = await fetch('/api/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ games })
        });
        const data = await res.json();
        if (res.ok) {
            setRecommendedGame(data);
        } else {
            console.error("Recs error:", data.error);
            alert("Failed to fetch recommendations.");
        }
    } catch (err) {
        console.error(err);
        alert("Network error.");
    } finally {
        setIsLoadingRecs(false);
    }
  };

  const handleGameClick = async (gameId) => {
    setSelectedGameDetails({ loading: true });
    setIsLoadingDetails(true);
    
    try {
        const res = await fetch(`/api/game-details?id=${gameId}`);
        const data = await res.json();
        
        if (res.ok) {
            setSelectedGameDetails(data);
        } else {
            console.error(data.error);
            setSelectedGameDetails(null);
            alert("Failed to load game details.");
        }
    } catch (err) {
        console.error(err);
        setSelectedGameDetails(null);
        alert("Network error.");
    } finally {
        setIsLoadingDetails(false);
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
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, playlists: updatedPlaylists });
    
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
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, playlists: updatedPlaylists });
    
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
        const { error } = await supabase.from('profiles').upsert({ id: session.user.id, playlists: updatedPlaylists });
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
              onClick={() => setShowProfileModal(true)}
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
              className={`category-btn`} 
              onClick={handleRecommendGame}
              disabled={isRecommending}
            >
              {isRecommending ? '🔮 Searching...' : '🔮 Discover New Game'}
            </button>
            
            <button 
              className={`category-btn ${currentView === "errands" ? "active" : ""}`} 
              onClick={() => {
                setCurrentView("errands");
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              📝 Errands
            </button>
        </nav>

        <div className="settings-section" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', textAlign: 'center', opacity: 0.7 }}>
            Theme: {THEMES.find(t => t.id === currentTheme)?.label || "Unknown"}
          </div>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '500px', position: 'relative' }} ref={searchContainerRef}>
              <div className="search-container" style={{ flex: 1, maxWidth: 'none' }}>
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  id="game-search" 
                  placeholder="Search for games to add..." 
                  value={searchQuery}
                  onChange={handleSearchInput}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2 || searchGenres.length > 0 || searchYearStart || searchYearEnd) setShowSearchResults(true);
                  }}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              <button 
                  className="btn outline" 
                  onClick={() => setShowFilters(!showFilters)}
                  title="Advanced Filters"
                  style={{ padding: '0.5rem', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease', transform: showFilters ? 'rotate(90deg)' : 'none' }}
              >
                  ⚙️
              </button>

            {showFilters && (
                <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.75rem', zIndex: 100, padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Genres</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {FILTER_GENRES.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => toggleGenre(g.id)}
                                    style={{
                                        padding: '0.4rem 1rem',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        fontWeight: searchGenres.includes(g.id) ? 'bold' : 'normal',
                                        border: searchGenres.includes(g.id) ? '1px solid var(--accent-color)' : '1px solid var(--glass-border)',
                                        backgroundColor: searchGenres.includes(g.id) ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                                        color: searchGenres.includes(g.id) ? '#fff' : 'var(--text-primary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: searchGenres.includes(g.id) ? '0 4px 12px rgba(var(--accent-color-rgb), 0.3)' : 'none'
                                    }}
                                    onMouseEnter={(e) => { if(!searchGenres.includes(g.id)) e.target.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
                                    onMouseLeave={(e) => { if(!searchGenres.includes(g.id)) e.target.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>Release Year Range</label>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <input 
                                type="number" 
                                placeholder="YYYY" 
                                value={searchYearStart} 
                                onChange={(e) => handleYearChange('start', e.target.value)} 
                                style={{ width: '90px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', fontSize: '0.95rem', textAlign: 'center', outline: 'none' }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                            />
                            <span style={{color: 'var(--text-secondary)', fontWeight: 'bold'}}>—</span>
                            <input 
                                type="number" 
                                placeholder="YYYY" 
                                value={searchYearEnd} 
                                onChange={(e) => handleYearChange('end', e.target.value)}
                                style={{ width: '90px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', fontSize: '0.95rem', textAlign: 'center', outline: 'none' }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                            />
                        </div>
                    </div>
                </div>
            )}
            
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
          
          <button 
            className="theme-toggle-btn" 
            onClick={cycleTheme} 
            title="Cycles through possible themes"
          >
            🎨
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
                                        onClick={() => handleGameClick(game.game_id)}
                                        style={{ cursor: 'pointer' }}
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
                                    {/* Game Info Overlay */}
                                    <div className="game-info-overlay">
                                        <div className="game-title" title={game.name}>{game.name}</div>
                                        <a href={ignSearchUrl} target="_blank" rel="noopener noreferrer" className="ign-link-text">
                                            IGN
                                        </a>
                                    </div>
                                </div>
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



      {/* Recommendation Modal */}
      {recommendedGame && (
        <div className="modal">
          <div className="modal-content" style={{maxWidth: '450px', textAlign: 'center'}}>
            <h2>You might like...</h2>
            <img 
              src={recommendedGame.cover?.url ? (recommendedGame.cover.url.startsWith('//') ? `https:${recommendedGame.cover.url}` : recommendedGame.cover.url).replace('t_thumb', 't_cover_big') : "https://via.placeholder.com/300x400?text=No+Image"} 
              alt={recommendedGame.name} 
              style={{width: '100%', borderRadius: '8px', margin: '1rem 0', maxHeight: '350px', objectFit: 'contain'}} 
            />
            <h3 style={{marginBottom: '1rem'}}>{recommendedGame.name}</h3>
            <div style={{display: 'flex', gap: '1rem', flexDirection: 'column'}}>
              <div style={{display: 'flex', gap: '1rem'}}>
                <button className="btn primary" style={{flex: 1}} onClick={() => {
                  setRecommendedGame(null);
                  initAddGame(recommendedGame);
                }}>Add to Shelf</button>
                <button className="btn outline" style={{flex: 1}} onClick={() => {
                  setRecommendedGame(null);
                  handleGameClick(recommendedGame.id);
                }}>View Details</button>
              </div>
              <button className="btn outline" style={{width: '100%', borderColor: 'transparent'}} onClick={() => setRecommendedGame(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="modal">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <h2 style={{margin: 0}}>Profile Settings</h2>
                <button className="btn outline" style={{padding: '0.25rem 0.6rem', minWidth: 'auto', fontSize: '1.2rem', borderRadius: '50%'}} onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '1.5rem'}}>
                <div style={{position: 'relative'}}>
                    <img 
                        src={profilePic} 
                        alt="Profile" 
                        style={{width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-color)'}}
                    />
                    <button 
                        className="btn primary"
                        style={{position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '12px'}}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Change
                    </button>
                </div>
            </div>

            <form onSubmit={(e) => { handleSaveProfile(e); setShowProfileModal(false); }}>
                <div className="form-group" style={{textAlign: 'left', marginBottom: '1rem'}}>
                    <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Share ID (Custom URL)</label>
                    <div style={{display: 'flex', alignItems: 'stretch'}}>
                        <span style={{background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRight: 'none', padding: '0.75rem', borderRadius: '8px 0 0 8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center'}}>gameshelf.app/u/</span>
                        <input 
                            type="text" 
                            value={shareId} 
                            onChange={(e) => setShareId(e.target.value)}
                            placeholder="your-custom-id"
                            className="form-control"
                            style={{borderRadius: '0 8px 8px 0'}}
                        />
                    </div>
                </div>
                
                <h3 style={{fontSize: '1.1rem', margin: '1.5rem 0 1rem 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', textAlign: 'left'}}>Gamer Tags</h3>
                
                <div className="form-group" style={{textAlign: 'left', marginBottom: '1rem'}}>
                    <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Xbox Gamertag</label>
                    <input 
                        type="text" 
                        value={gamerTags.xbox || ""} 
                        onChange={(e) => setGamerTags({...gamerTags, xbox: e.target.value})}
                        placeholder="Enter Xbox Gamertag"
                        className="form-control"
                    />
                </div>
                
                <div className="form-group" style={{textAlign: 'left', marginBottom: '1rem'}}>
                    <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>PlayStation Network ID</label>
                    <input 
                        type="text" 
                        value={gamerTags.psn || ""} 
                        onChange={(e) => setGamerTags({...gamerTags, psn: e.target.value})}
                        placeholder="Enter PSN ID"
                        className="form-control"
                    />
                </div>

                <div className="form-group" style={{textAlign: 'left', marginBottom: '1.5rem'}}>
                    <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Steam ID / Username</label>
                    <input 
                        type="text" 
                        value={gamerTags.steam || ""} 
                        onChange={(e) => setGamerTags({...gamerTags, steam: e.target.value})}
                        placeholder="Enter Steam Username"
                        className="form-control"
                    />
                </div>

                <button type="submit" className="btn primary" disabled={profileSaving} style={{width: '100%', padding: '0.85rem', fontWeight: 600}}>
                    {profileSaving ? "Saving..." : "Save Profile"}
                </button>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
                    <button type="button" className="theme-toggle-btn" onClick={cycleTheme} style={{ width: '45px', height: '45px', fontSize: '1.2rem' }} title="Change Theme">
                        {currentTheme === 'theme-glass-dark' ? '🌙' : currentTheme === 'theme-retro' ? '🕹️' : '☀️'}
                    </button>
                    <button type="button" className="btn outline" onClick={handleSignOut} style={{ padding: '0.25rem 1.5rem', flex: 1 }}>
                        Sign Out
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

    
      {/* Game Details Side Panel */}
      {selectedGameDetails && (
        <div className="side-panel-overlay" onClick={() => setSelectedGameDetails(null)}>
            <div className="side-panel" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setSelectedGameDetails(null)} style={{ alignSelf: 'flex-end', marginBottom: '1rem', position: 'static' }}>×</button>
                {isLoadingDetails ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Game Details...</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', textAlign: 'center' }}>
                            {selectedGameDetails.cover?.url ? (
                                <img 
                                    src={selectedGameDetails.cover.url.startsWith('//') ? `https:${selectedGameDetails.cover.url.replace('t_thumb', 't_cover_big')}` : selectedGameDetails.cover.url} 
                                    alt={selectedGameDetails.name} 
                                    style={{ width: '200px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginBottom: '1.5rem' }}
                                />
                            ) : (
                                <div style={{ width: '200px', height: '280px', backgroundColor: 'var(--glass-border)', borderRadius: '12px', marginBottom: '1.5rem' }}></div>
                            )}
                            <h2 style={{ margin: '0 0 1rem 0', color: 'var(--accent-color)', fontSize: '2.2rem', lineHeight: '1.2' }}>{selectedGameDetails.name}</h2>
                            
                            <div style={{ display: 'flex', gap: '1.5rem', opacity: 0.9, marginBottom: '1.2rem', fontSize: '1rem' }}>
                                {selectedGameDetails.first_release_date && (
                                    <span>
                                        <strong>Released:</strong> {new Date(selectedGameDetails.first_release_date * 1000).toLocaleDateString()}
                                    </span>
                                )}
                                {selectedGameDetails.total_rating && (
                                    <span>
                                        <strong>IGDB:</strong> <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{Math.round(selectedGameDetails.total_rating)}</span><span style={{ fontSize: '0.8em', opacity: 0.7 }}>/100</span>
                                    </span>
                                )}
                            </div>
                            
                            {selectedGameDetails.genres && selectedGameDetails.genres.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                                    {selectedGameDetails.genres.map(g => (
                                        <span key={g.id} style={{ padding: '0.4rem 1rem', backgroundColor: 'var(--glass-border)', borderRadius: '16px', fontSize: '0.9rem', opacity: 0.9 }}>
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', color: 'var(--text-primary)' }}>Summary</h3>
                            <p style={{ margin: 0, lineHeight: '1.8', opacity: 0.85, fontSize: '1.1rem', textAlign: 'justify' }}>
                                {selectedGameDetails.summary || "No description available."}
                            </p>
                        </div>
                        {!games.find(g => g.game_id === selectedGameDetails.id) && (
                            <button 
                                className="btn primary" 
                                style={{ marginTop: '1.5rem', padding: '1rem', width: '100%', fontSize: '1.1rem', fontWeight: 'bold', boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                                onClick={() => {
                                    setSelectedGameDetails(null);
                                    initAddGame(selectedGameDetails);
                                }}
                            >
                                + Add to Shelf
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
          <div className="mobile-nav-item mobile-playlist-trigger" style={{ position: 'relative' }}>
              <button 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, zIndex: 1, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId(openDropdownId === 'mobile-playlist' ? null : 'mobile-playlist');
                  }}
              />
              <span className="mobile-nav-icon">📚</span>
              <span className="mobile-nav-label">Playlists</span>
              
              {openDropdownId === 'mobile-playlist' && (
                  <div className="custom-dropdown-menu" style={{ 
                      bottom: 'calc(100% + 15px)', 
                      left: '0.5rem', 
                      right: 'auto', 
                      minWidth: '160px',
                      zIndex: 20
                  }}>
                      <button 
                          className="custom-dropdown-item"
                          onClick={(e) => { 
                              e.stopPropagation(); 
                              setCurrentView("home"); 
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              setOpenDropdownId(null); 
                          }}
                          style={{ fontWeight: currentView === "home" ? 'bold' : 'normal', color: currentView === "home" ? 'var(--accent-color)' : 'inherit', textAlign: 'left' }}
                      >
                          Home (All)
                      </button>
                      {playlists.map(p => (
                          <button 
                              key={p.id}
                              className="custom-dropdown-item"
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setCurrentView(`playlist-${p.id}`); 
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                  setOpenDropdownId(null); 
                              }}
                              style={{ fontWeight: currentView === `playlist-${p.id}` ? 'bold' : 'normal', color: currentView === `playlist-${p.id}` ? 'var(--accent-color)' : 'inherit', textAlign: 'left' }}
                          >
                              {p.label}
                          </button>
                      ))}
                  </div>
              )}
          </div>
          
          <button 
              className={`mobile-nav-item ${currentView === "errands" ? "active" : ""}`}
              onClick={() => {
                  setCurrentView("errands");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
          >
              <span className="mobile-nav-icon">📝</span>
              <span className="mobile-nav-label">Errands</span>
          </button>
          
          <button 
              className="mobile-nav-item"
              onClick={() => setShowProfileModal(true)}
          >
              <span className="mobile-nav-icon">👤</span>
              <span className="mobile-nav-label">Profile</span>
          </button>
      </nav>
    </div>
  );
}
