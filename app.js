// API Configuration
const API_BASE_URL = 'http://127.0.0.1:8000';

// State Management
let currentUser = null;
let authToken = null;
let currentPage = 1;
let currentOffset = 0;
const LIMIT = 12;

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
            const error = await response.json();
            showMessage(error.detail || 'Error updating preferences', 'error');
        }
    } catch (error) {
        console.error('Error updating preferences:', error);
        showMessage('Error updating preferences', 'error');
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

