// API Configuration
const API_BASE_URL = 'http://127.0.0.1:8000';

// State Management
let currentUser = null;
let authToken = null;
let currentPage = 1;
let currentOffset = 0;
const LIMIT = 12;

// Graph state
let graphNetwork = null;
let originalGraphData = null;
let filteredNodes = null;
let filteredEdges = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuth();
    loadGenres(); // Load genres for dropdown
    // Show appropriate page based on auth status
    if (localStorage.getItem('authToken')) {
        showPage('books-page');
        loadBooks();
    } else {
        showPage('login-prompt');
    }
});

// Event Listeners
function setupEventListeners() {
    // Auth
    document.getElementById('btn-login').addEventListener('click', () => showAuthModal('login'));
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('prompt-login').addEventListener('click', () => showAuthModal('login'));
    document.getElementById('auth-form').addEventListener('submit', handleAuth);
    document.getElementById('auth-switch-link').addEventListener('click', toggleAuthMode);
    document.querySelector('.close').addEventListener('click', closeAuthModal);
    document.getElementById('close-book-modal').addEventListener('click', closeBookModal);

    // Navigation
    document.getElementById('nav-books').addEventListener('click', (e) => {
        e.preventDefault();
        if (authToken) {
            showPage('books-page');
            loadBooks();
        } else {
            showAuthModal('login');
        }
    });
    document.getElementById('nav-recommendations').addEventListener('click', (e) => {
        e.preventDefault();
        if (authToken) {
            showPage('recommendations-page');
            loadRecommendations();
        } else {
            showAuthModal('login');
        }
    });
    document.getElementById('nav-profile').addEventListener('click', (e) => {
        e.preventDefault();
        if (authToken) {
            showPage('profile-page');
            loadProfile();
        } else {
            showAuthModal('login');
        }
    });

    // Books
    document.getElementById('search-btn').addEventListener('click', () => {
        currentPage = 1;
        currentOffset = 0;
        loadBooks();
    });
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            currentOffset -= LIMIT;
            loadBooks();
        }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        currentPage++;
        currentOffset += LIMIT;
        loadBooks();
    });

    // Recommendations
    document.getElementById('refresh-recommendations').addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Refresh recommendations clicked');
        loadRecommendations();
    });

    // Profile
    document.getElementById('preferences-form').addEventListener('submit', updatePreferences);

    // Admin
    document.getElementById('nav-admin').addEventListener('click', (e) => {
        e.preventDefault();
        if (authToken) {
            showPage('admin-page');
            loadAdminDashboard();
        } else {
            showAuthModal('login');
        }
    });
    document.getElementById('refresh-metrics').addEventListener('click', loadMetrics);
    document.getElementById('load-overview-graph').addEventListener('click', loadOverviewGraph);
    document.getElementById('load-user-graph').addEventListener('click', () => {
        const userId = document.getElementById('user-select').value;
        if (userId) {
            loadUserGraph(userId);
        } else {
            showMessage('Please select a user', 'error');
        }
    });
    
    // Graph controls
    const layoutSelect = document.getElementById('layout-select');
    const filterSelect = document.getElementById('filter-select');
    const resetZoomBtn = document.getElementById('reset-zoom');
    const fitNetworkBtn = document.getElementById('fit-network');
    
    if (layoutSelect) {
        layoutSelect.addEventListener('change', function() {
            if (graphNetwork && originalGraphData) {
                renderGraph(originalGraphData, document.getElementById('graph-container'));
            }
        });
    }
    
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            if (!graphNetwork || !originalGraphData) return;
            
            const filter = filterSelect.value;
            let nodes = filteredNodes;
            let edges = filteredEdges;
            
            if (filter === 'users') {
                nodes = filteredNodes.filter(n => n.group === 'user');
                const nodeIds = new Set(nodes.map(n => n.id));
                edges = filteredEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
            } else if (filter === 'books') {
                nodes = filteredNodes.filter(n => n.group === 'book');
                const nodeIds = new Set(nodes.map(n => n.id));
                edges = filteredEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
            } else {
                nodes = filteredNodes;
                edges = filteredEdges;
            }
            
            graphNetwork.setData({ nodes, edges });
            document.getElementById('node-count').textContent = `${nodes.length} nodes`;
            document.getElementById('edge-count').textContent = `${edges.length} edges`;
        });
    }
    
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', function() {
            if (graphNetwork) {
                graphNetwork.moveTo({
                    position: { x: 0, y: 0 },
                    scale: 1,
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }
        });
    }
    
    if (fitNetworkBtn) {
        fitNetworkBtn.addEventListener('click', function() {
            if (graphNetwork) {
                graphNetwork.fit({
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }
        });
    }
}

// Auth Functions
function checkAuth() {
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        loadCurrentUser();
        document.getElementById('btn-login').style.display = 'none';
        document.getElementById('btn-logout').style.display = 'block';
    } else {
        document.getElementById('btn-login').style.display = 'block';
        document.getElementById('btn-logout').style.display = 'none';
    }
}

async function loadCurrentUser() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            // Check if user is admin (check is_admin field from backend)
            // Backend should return is_admin in user object, but we'll also check email as fallback
            const isAdmin = currentUser.is_admin || (currentUser.email && currentUser.email.toLowerCase().includes('admin'));
            if (isAdmin) {
                document.getElementById('nav-admin').style.display = 'block';
            } else {
                document.getElementById('nav-admin').style.display = 'none';
            }
        } else if (response.status === 401) {
            // Only logout on authentication errors (401 Unauthorized)
            console.log('Token expired or invalid, logging out');
            logout();
        } else {
            // For other errors (network, server errors), keep the token but log the error
            console.error('Error loading user:', response.status, response.statusText);
            // Don't logout on network/server errors - user might still be valid
        }
    } catch (error) {
        // Network errors - don't logout, just log
        console.error('Network error loading user:', error);
        // Keep the token - might be a temporary network issue
    }
}

function showAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-title');
    const signupFields = document.getElementById('signup-fields');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch-link');

    // Reset form
    document.getElementById('auth-form').reset();

    if (mode === 'login') {
        title.textContent = 'Login';
        signupFields.style.display = 'none';
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Sign up';
    } else {
        title.textContent = 'Sign Up';
        signupFields.style.display = 'block';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Login';
    }
    modal.style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('auth-form').reset();
}

function toggleAuthMode(e) {
    e.preventDefault();
    const title = document.getElementById('auth-title');
    const currentMode = title.textContent.trim();
    if (currentMode === 'Login') {
        showAuthModal('signup');
    } else {
        showAuthModal('login');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const title = document.getElementById('auth-title').textContent.trim();

    if (!email || !password) {
        showMessage('Please fill in email and password', 'error');
        return;
    }

    const isSignup = title === 'Sign Up';
    const endpoint = isSignup ? '/auth/signup' : '/auth/login';
    
    const body = isSignup ? {
        email,
        password,
        first_name: document.getElementById('first-name').value.trim() || null,
        last_name: document.getElementById('last-name').value.trim() || null
    } : { email, password };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);
            closeAuthModal();
            checkAuth();
            showMessage('Successfully ' + (isSignup ? 'signed up' : 'logged in') + '!', 'success');
            showPage('books-page');
            loadBooks();
        } else {
            showMessage(data.detail || 'Authentication failed', 'error');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showMessage('Network error. Please check if the backend is running.', 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    checkAuth();
    showPage('login-prompt');
    showMessage('Logged out successfully', 'success');
}

// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page, .login-prompt').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';
}

// Load Genres
async function loadGenres() {
    try {
        const response = await fetch(`${API_BASE_URL}/books/genres`);
        if (response.ok) {
            const genres = await response.json();
            const genreFilter = document.getElementById('genre-filter');
            const prefGenres = document.getElementById('pref-genres');
            
            // Populate genre filter dropdown
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreFilter.appendChild(option);
            });
            
            // Also populate preferences genres dropdown if it exists
            if (prefGenres && prefGenres.tagName === 'SELECT') {
                genres.forEach(genre => {
                    const option = document.createElement('option');
                    option.value = genre;
                    option.textContent = genre;
                    prefGenres.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

// Books Functions
async function loadBooks() {
    const search = document.getElementById('search-input').value;
    const author = document.getElementById('author-filter').value;
    const genre = document.getElementById('genre-filter').value;

    const params = new URLSearchParams({
        limit: LIMIT,
        offset: currentOffset
    });
    if (search) params.append('search', search);
    if (author) params.append('author', author);
    if (genre) params.append('genre', genre);

    try {
        const response = await fetch(`${API_BASE_URL}/books/?${params}`);
        const books = await response.json();
        displayBooks(books);
        updatePagination();
    } catch (error) {
        console.error('Error loading books:', error);
        showMessage('Error loading books', 'error');
    }
}

function displayBooks(books) {
    displayBooksInGrid(books, 'books-grid');
}

function updatePagination() {
    document.getElementById('page-info').textContent = `Page ${currentPage}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
}

// Recommendations
async function loadRecommendations() {
    if (!authToken) {
        showMessage('Please login to see recommendations', 'error');
        showAuthModal('login');
        return;
    }

    const grid = document.getElementById('recommendations-grid');
    if (!grid) {
        console.error('Recommendations grid not found!');
        return;
    }
    
    // Show loading state
    grid.innerHTML = '<p class="loading">Loading recommendations...</p>';

    try {
        console.log('Fetching recommendations...');
        const response = await fetch(`${API_BASE_URL}/recommend/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ limit: 20 })
        });

        console.log('Recommendations response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Recommendations data:', data);
            if (data.recommendations && data.recommendations.length > 0) {
                // Use the recommendations grid specifically
                displayBooksInGrid(data.recommendations, 'recommendations-grid');
                showMessage(`Found ${data.recommendations.length} recommendations!`, 'success');
            } else {
                grid.innerHTML = '<p class="loading">No recommendations available. Try interacting with some books first!</p>';
            }
        } else {
            const error = await response.json();
            console.error('Recommendations error:', error);
            const errorMsg = error.detail || 'No recommendations available. Try interacting with some books first!';
            grid.innerHTML = `<p class="loading">${errorMsg}</p>`;
            showMessage(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
        grid.innerHTML = '<p class="loading">Error loading recommendations. Please check if the backend is running.</p>';
        showMessage('Error loading recommendations. Check console for details.', 'error');
    }
}

// Helper function to display books in a specific grid
function displayBooksInGrid(books, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) {
        console.error(`Grid ${gridId} not found!`);
        return;
    }
    
    if (books.length === 0) {
        grid.innerHTML = '<p class="loading">No books found</p>';
        return;
    }

    grid.innerHTML = books.map(book => {
        // Extract published date and info link from book object
        const publishedDate = book.published_date || null;
        const infoLink = book.info_link || null;

        return `
        <div class="book-card">
            <h3>${escapeHtml(book.title)}</h3>
            <p class="author">by ${escapeHtml(book.author || 'Unknown Author')}</p>
            ${publishedDate ? `<p class="published-date">Published: ${escapeHtml(publishedDate)}</p>` : ''}
            <p class="description">${escapeHtml(book.description || 'No description available')}</p>
            ${book.genres && book.genres.length > 0 ? `
                <div class="genres">
                    ${book.genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="book-actions">
                <button class="btn-view" onclick="showBookDetails(${book.id})">View Details</button>
                <button class="btn-like" onclick="interactWithBook(${book.id}, 'like')">Like</button>
            </div>
            ${infoLink ? `<a href="${escapeHtml(infoLink)}" target="_blank" class="read-more-link">Read More →</a>` : ''}
        </div>
    `;
    }).join('');
}

// Profile
async function loadProfile() {
    if (!authToken) return;

    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const user = await response.json();
            displayProfile(user);
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('Error loading profile', 'error');
    }
}

function displayProfile(user) {
    const info = document.getElementById('profile-info');
    info.innerHTML = `
        <h3>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</h3>
        <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
    `;

    // Load preferences if they exist
    if (user.kyc_preferences) {
        const prefs = user.kyc_preferences;
        if (prefs.genres) {
            document.getElementById('pref-genres').value = Array.isArray(prefs.genres) 
                ? prefs.genres.join(', ') 
                : prefs.genres;
        }
        if (prefs.authors) {
            document.getElementById('pref-authors').value = Array.isArray(prefs.authors) 
                ? prefs.authors.join(', ') 
                : prefs.authors;
        }
        // Handle both reading_preferences and description (backend maps reading_preferences to description)
        if (prefs.reading_preferences) {
            document.getElementById('pref-reading-prefs').value = prefs.reading_preferences;
        } else if (prefs.description) {
            document.getElementById('pref-reading-prefs').value = prefs.description;
        }
    }
}

async function updatePreferences(e) {
    e.preventDefault();
    if (!authToken) return;

    const genres = document.getElementById('pref-genres').value.split(',').map(g => g.trim()).filter(g => g);
    const authors = document.getElementById('pref-authors').value.split(',').map(a => a.trim()).filter(a => a);
    const readingPrefs = document.getElementById('pref-reading-prefs').value.trim();

    const preferences = {};
    if (genres.length > 0) preferences.genres = genres;
    if (authors.length > 0) preferences.authors = authors;
    if (readingPrefs) preferences.reading_preferences = readingPrefs;

    try {
        const response = await fetch(`${API_BASE_URL}/users/me/preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(preferences)
        });

        if (response.ok) {
            showMessage('Preferences updated successfully!', 'success');
            loadProfile();
        } else {
            let errorMessage = 'Error updating preferences';
            try {
                const error = await response.json();
                errorMessage = error.detail || error.message || errorMessage;
                console.error('Preferences update error:', error);
            } catch (e) {
                console.error('Failed to parse error response:', e);
                errorMessage = `Error ${response.status}: ${response.statusText}`;
            }
            showMessage(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error updating preferences:', error);
        if (error.message && error.message.includes('CORS')) {
            showMessage('CORS error: Make sure the backend is running and CORS is configured correctly', 'error');
        } else {
            showMessage(`Network error: ${error.message || 'Error updating preferences'}`, 'error');
        }
    }
}

// Book Details Modal
async function showBookDetails(bookId) {
    // Record view interaction
    if (authToken) {
        interactWithBook(bookId, 'view');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}`);
        if (!response.ok) {
            showMessage('Book not found', 'error');
            return;
        }

        const book = await response.json();
        const modal = document.getElementById('book-details-modal');
        const content = document.getElementById('book-details-content');

        // Extract data from book object
        const publishedDate = book.published_date || null;
        const publisher = book.publisher || null;
        const ratingsCount = book.ratings_count || null;
        const allAuthors = book.all_authors || (book.author ? [book.author] : []);
        const image = book.image || null;
        const infoLink = book.info_link || null;
        const previewLink = book.preview_link || null;

        content.innerHTML = `
            ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(book.title)}" class="book-cover" onerror="this.style.display='none'">` : ''}
            <h2>${escapeHtml(book.title)}</h2>
            <p class="author">by ${allAuthors.length > 0 ? escapeHtml(allAuthors.join(', ')) : escapeHtml(book.author || 'Unknown Author')}</p>
            <div class="metadata">
                ${publishedDate ? `<div class="metadata-item"><span class="metadata-label">Published</span><span class="metadata-value">${escapeHtml(publishedDate)}</span></div>` : ''}
                ${publisher ? `<div class="metadata-item"><span class="metadata-label">Publisher</span><span class="metadata-value">${escapeHtml(publisher)}</span></div>` : ''}
                ${ratingsCount ? `<div class="metadata-item"><span class="metadata-label">Ratings</span><span class="metadata-value">${ratingsCount}</span></div>` : ''}
            </div>
            ${book.genres && book.genres.length > 0 ? `
                <div style="margin: 1rem 0;">
                    <span class="metadata-label" style="display: block; margin-bottom: 0.5rem;">Genres</span>
                    <div class="genres">
                        ${book.genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="description">${escapeHtml(book.description || 'No description available')}</div>
            <div class="book-links">
                ${infoLink ? `<a href="${escapeHtml(infoLink)}" target="_blank">Read More</a>` : ''}
                ${previewLink ? `<a href="${escapeHtml(previewLink)}" target="_blank">Preview</a>` : ''}
            </div>
        `;

        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading book details:', error);
        showMessage('Error loading book details', 'error');
    }
}

function closeBookModal() {
    document.getElementById('book-details-modal').style.display = 'none';
}

// Interactions
async function interactWithBook(bookId, type) {
    if (!authToken) {
        return; // Silent for view, but show modal for like
    }

    try {
        const response = await fetch(`${API_BASE_URL}/interactions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                book_id: bookId,
                interaction_type: type
            })
        });

        if (response.ok && type === 'like') {
            showMessage('Book liked!', 'success');
        }
    } catch (error) {
        console.error('Error recording interaction:', error);
    }
}


// Utility Functions
function showMessage(message, type) {
    const existing = document.querySelector('.message');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(msg, container.firstChild);

    setTimeout(() => msg.remove(), 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Admin Dashboard Functions
async function loadAdminDashboard() {
    await loadMetrics();
    await loadUsersList();
}

async function loadMetrics() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/metrics?k=10&min_interactions=5`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const metrics = data.metrics || {};
            const counts = data.counts || {};
            const coverage = data.coverage || {};
            
            // Error metrics
            document.getElementById('metric-rmse').textContent = metrics.rmse !== null && metrics.rmse !== undefined 
                ? metrics.rmse.toFixed(4) : 'N/A';
            document.getElementById('metric-mae').textContent = metrics.mae !== null && metrics.mae !== undefined 
                ? metrics.mae.toFixed(4) : 'N/A';
            
            // Precision@K metrics (now a dictionary)
            const precisionAtK = metrics.precision_at_k || {};
            document.getElementById('metric-precision-5').textContent = precisionAtK['5'] !== null && precisionAtK['5'] !== undefined
                ? precisionAtK['5'].toFixed(4) : 'N/A';
            document.getElementById('metric-precision-10').textContent = precisionAtK['10'] !== null && precisionAtK['10'] !== undefined
                ? precisionAtK['10'].toFixed(4) : 'N/A';
            document.getElementById('metric-precision-20').textContent = precisionAtK['20'] !== null && precisionAtK['20'] !== undefined
                ? precisionAtK['20'].toFixed(4) : 'N/A';
            document.getElementById('metric-precision-50').textContent = precisionAtK['50'] !== null && precisionAtK['50'] !== undefined
                ? precisionAtK['50'].toFixed(4) : 'N/A';
            
            // Recall@K metrics
            const recallAtK = metrics.recall_at_k || {};
            document.getElementById('metric-recall-5').textContent = recallAtK['5'] !== null && recallAtK['5'] !== undefined
                ? recallAtK['5'].toFixed(4) : 'N/A';
            document.getElementById('metric-recall-10').textContent = recallAtK['10'] !== null && recallAtK['10'] !== undefined
                ? recallAtK['10'].toFixed(4) : 'N/A';
            document.getElementById('metric-recall-20').textContent = recallAtK['20'] !== null && recallAtK['20'] !== undefined
                ? recallAtK['20'].toFixed(4) : 'N/A';
            document.getElementById('metric-recall-50').textContent = recallAtK['50'] !== null && recallAtK['50'] !== undefined
                ? recallAtK['50'].toFixed(4) : 'N/A';
            
            // nDCG@K metrics
            const ndcgAtK = metrics.ndcg_at_k || {};
            document.getElementById('metric-ndcg-5').textContent = ndcgAtK['5'] !== null && ndcgAtK['5'] !== undefined
                ? ndcgAtK['5'].toFixed(4) : 'N/A';
            document.getElementById('metric-ndcg-10').textContent = ndcgAtK['10'] !== null && ndcgAtK['10'] !== undefined
                ? ndcgAtK['10'].toFixed(4) : 'N/A';
            document.getElementById('metric-ndcg-20').textContent = ndcgAtK['20'] !== null && ndcgAtK['20'] !== undefined
                ? ndcgAtK['20'].toFixed(4) : 'N/A';
            document.getElementById('metric-ndcg-50').textContent = ndcgAtK['50'] !== null && ndcgAtK['50'] !== undefined
                ? ndcgAtK['50'].toFixed(4) : 'N/A';
            
            // Counts
            document.getElementById('metric-users').textContent = counts.users || 0;
            document.getElementById('metric-books').textContent = counts.books || 0;
            document.getElementById('metric-interactions').textContent = counts.interactions || 0;
            document.getElementById('metric-content-cov').textContent = coverage.content_embeddings !== undefined
                ? `${coverage.content_embeddings}%` : 'N/A';
            document.getElementById('metric-cf-cov').textContent = coverage.cf_embeddings !== undefined
                ? `${coverage.cf_embeddings}%` : 'N/A';
            document.getElementById('metric-gnn-cov').textContent = coverage.gnn_vectors !== undefined
                ? `${coverage.gnn_vectors}%` : 'N/A';
            
            // RMSE Table
            const rmseTable = metrics.rmse_table || [];
            const tableBody = document.getElementById('rmse-table-body');
            if (rmseTable.length > 0) {
                tableBody.innerHTML = rmseTable.map(row => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 0.75rem; font-size: 0.9em;">${row.user_id.substring(0, 8)}...</td>
                        <td style="padding: 0.75rem;">${row.book_id}</td>
                        <td style="padding: 0.75rem; text-align: right;">${row.actual.toFixed(3)}</td>
                        <td style="padding: 0.75rem; text-align: right;">${row.predicted.toFixed(3)}</td>
                        <td style="padding: 0.75rem; text-align: right; color: ${Math.abs(row.error) > 1 ? '#d32f2f' : '#666'};">${row.error > 0 ? '+' : ''}${row.error.toFixed(3)}</td>
                    </tr>
                `).join('');
            } else {
                tableBody.innerHTML = '<tr><td colspan="5" style="padding: 1rem; text-align: center; color: #999;">No RMSE data available</td></tr>';
            }
        } else if (response.status === 403) {
            showMessage('Admin access required', 'error');
            showPage('books-page');
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Error loading metrics', 'error');
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
        showMessage('Error loading metrics', 'error');
    }
}

async function loadUsersList() {
    if (!authToken) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/users?limit=100`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const users = data.users || [];
            const container = document.getElementById('users-list-container');
            const select = document.getElementById('user-select');
            
            // Populate select dropdown
            select.innerHTML = '<option value="">Select a user...</option>';
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.email} (${user.interaction_count} interactions)`;
                select.appendChild(option);
            });
            
            // Display users list
            container.innerHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
                    <thead>
                        <tr style="background: var(--background); border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 0.75rem; text-align: left;">Email</th>
                            <th style="padding: 0.75rem; text-align: left;">Name</th>
                            <th style="padding: 0.75rem; text-align: center;">Interactions</th>
                            <th style="padding: 0.75rem; text-align: center;">CF Vector</th>
                            <th style="padding: 0.75rem; text-align: center;">KYC Embedding</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 0.75rem;">${escapeHtml(user.email)}</td>
                                <td style="padding: 0.75rem;">${escapeHtml((user.first_name || '') + ' ' + (user.last_name || '')).trim() || '-'}</td>
                                <td style="padding: 0.75rem; text-align: center;">${user.interaction_count}</td>
                                <td style="padding: 0.75rem; text-align: center;">${user.has_cf_vector ? '✓' : '✗'}</td>
                                <td style="padding: 0.75rem; text-align: center;">${user.has_kyc_embedding ? '✓' : '✗'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (response.status === 403) {
            showMessage('Admin access required', 'error');
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Error loading users', 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showMessage('Error loading users', 'error');
    }
}

async function loadOverviewGraph() {
    if (!authToken) return;
    
    const container = document.getElementById('graph-container');
    container.innerHTML = '<p class="loading">Loading graph...</p>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/graph/overview?max_users=50&max_books=100`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const graph = await response.json();
            renderGraph(graph, container);
        } else if (response.status === 403) {
            showMessage('Admin access required', 'error');
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Error loading graph', 'error');
            container.innerHTML = '<p class="loading">Error loading graph</p>';
        }
    } catch (error) {
        console.error('Error loading graph:', error);
        showMessage('Error loading graph', 'error');
        container.innerHTML = '<p class="loading">Error loading graph</p>';
    }
}

async function loadUserGraph(userId) {
    if (!authToken) return;
    
    const container = document.getElementById('graph-container');
    container.innerHTML = '<p class="loading">Loading user graph...</p>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/graph/user/${userId}?max_books=20`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const graph = await response.json();
            renderGraph(graph, container);
        } else if (response.status === 403) {
            showMessage('Admin access required', 'error');
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Error loading user graph', 'error');
            container.innerHTML = '<p class="loading">Error loading user graph</p>';
        }
    } catch (error) {
        console.error('Error loading user graph:', error);
        showMessage('Error loading user graph', 'error');
        container.innerHTML = '<p class="loading">Error loading user graph</p>';
    }
}

function renderGraph(graphData, container) {
    if (!graphData.nodes || !graphData.edges) {
        container.innerHTML = '<p class="loading">No graph data available</p>';
        return;
    }
    
    // Store original data for filtering
    originalGraphData = graphData;
    
    // Prepare nodes for vis-network with better styling
    const nodes = graphData.nodes.map(node => {
        const isUser = node.type === 'user';
        const label = node.label || node.title || node.name || String(node.id).substring(0, 20);
        const title = node.title || label || '';
        
        // Calculate node size based on connections (degree)
        const degree = graphData.edges.filter(e => 
            e.source === node.id || e.target === node.id
        ).length;
        const baseSize = isUser ? 25 : 20;
        const size = Math.min(baseSize + degree * 2, 50);
        
        return {
            id: node.id,
            label: label.length > 30 ? label.substring(0, 27) + '...' : label,
            title: `${title}\nType: ${node.type}\nConnections: ${degree}`,
            group: isUser ? 'user' : 'book',
            color: isUser 
                ? { 
                    background: '#6366f1', 
                    border: '#4f46e5',
                    highlight: { background: '#818cf8', border: '#6366f1' },
                    hover: { background: '#818cf8', border: '#6366f1' }
                }
                : { 
                    background: '#ec4899', 
                    border: '#be185d',
                    highlight: { background: '#f472b6', border: '#ec4899' },
                    hover: { background: '#f472b6', border: '#ec4899' }
                },
            shape: isUser ? 'dot' : 'box',
            size: size,
            font: {
                size: isUser ? 14 : 12,
                color: '#1f2937',
                face: 'Inter, system-ui, sans-serif',
                bold: isUser
            },
            borderWidth: 3,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 5,
                x: 2,
                y: 2
            }
        };
    });
    
    // Prepare edges for vis-network with better styling
    const edges = graphData.edges.map(edge => {
        const isSimilar = edge.type === 'similar';
        return {
            from: edge.source,
            to: edge.target,
            label: edge.type || '',
            color: isSimilar
                ? { 
                    color: '#10b981', 
                    highlight: '#059669',
                    hover: '#059669'
                }
                : { 
                    color: '#6b7280', 
                    highlight: '#374151',
                    hover: '#374151'
                },
            width: Math.max(1, Math.min((edge.weight || 1) * 2, 5)),
            dashes: isSimilar,
            smooth: {
                type: 'continuous',
                roundness: 0.5
            },
            arrows: {
                to: {
                    enabled: !isSimilar,
                    scaleFactor: 0.6,
                    type: 'arrow'
                }
            },
            font: {
                size: 10,
                align: 'middle',
                color: '#6b7280'
            }
        };
    });
    
    filteredNodes = nodes;
    filteredEdges = edges;
    
    // Clear container
    container.innerHTML = '';
    
    // Update stats
    document.getElementById('graph-stats').style.display = 'block';
    document.getElementById('node-count').textContent = `${nodes.length} nodes`;
    document.getElementById('edge-count').textContent = `${edges.length} edges`;
    
    // Get layout selection
    const layoutType = document.getElementById('layout-select')?.value || 'force';
    
    // Create network with improved options
    const data = { nodes, edges };
    const options = {
        nodes: {
            font: { 
                size: 14, 
                color: '#1f2937',
                face: 'Inter, system-ui, sans-serif'
            },
            borderWidth: 3,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 5
            },
            chosen: {
                node: function(values, id, selected, hovering) {
                    if (hovering || selected) {
                        values.size = values.size * 1.2;
                        values.borderWidth = 5;
                    }
                }
            }
        },
        edges: {
            font: { 
                size: 10, 
                align: 'middle',
                color: '#6b7280'
            },
            smooth: {
                type: 'continuous',
                roundness: 0.5
            },
            width: 2,
            chosen: {
                edge: function(values, id, selected, hovering) {
                    if (hovering || selected) {
                        values.width = values.width * 2;
                    }
                }
            }
        },
        physics: {
            enabled: true,
            stabilization: { 
                iterations: 250,
                fit: true
            },
            ...(layoutType === 'force' ? {
                forceAtlas2Based: {
                    gravitationalConstant: -50,
                    centralGravity: 0.01,
                    springLength: 200,
                    springConstant: 0.08,
                    damping: 0.4,
                    avoidOverlap: 1
                }
            } : layoutType === 'hierarchical' ? {
                hierarchicalRepulsion: {
                    centralGravity: 0.0,
                    springLength: 200,
                    springConstant: 0.01,
                    nodeDistance: 120,
                    damping: 0.09
                }
            } : {
                repulsion: {
                    centralGravity: 0.2,
                    springLength: 200,
                    springConstant: 0.05,
                    nodeDistance: 100,
                    damping: 0.09
                }
            })
        },
        layout: layoutType === 'hierarchical' ? {
            hierarchical: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 150,
                nodeSpacing: 200,
                treeSpacing: 200
            }
        } : layoutType === 'circular' ? {
            randomSeed: 2
        } : undefined,
        interaction: {
            hover: true,
            tooltipDelay: 100,
            zoomView: true,
            dragView: true,
            selectConnectedEdges: true,
            navigationButtons: true,
            keyboard: {
                enabled: true,
                speed: { x: 10, y: 10, zoom: 0.02 },
                bindToWindow: true
            }
        },
        configure: {
            enabled: false
        }
    };
    
    graphNetwork = new vis.Network(container, data, options);
    
    // Add event listeners for better interactivity
    graphNetwork.on('select', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
                console.log('Selected node:', node);
            }
        }
    });
    
    graphNetwork.on('hoverNode', function(params) {
        container.style.cursor = 'pointer';
    });
    
    graphNetwork.on('blurNode', function(params) {
        container.style.cursor = 'default';
    });
    
    // Fit network to screen after stabilization
    graphNetwork.once('stabilizationEnd', function() {
        graphNetwork.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    });
}


// Close modal when clicking outside
window.onclick = function(event) {
    const authModal = document.getElementById('auth-modal');
    const bookModal = document.getElementById('book-details-modal');
    if (event.target === authModal) {
        closeAuthModal();
    }
    if (event.target === bookModal) {
        closeBookModal();
    }
}

