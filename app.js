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
    checkAuth();
    setupEventListeners();
    showPage('login-prompt');
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
    document.getElementById('refresh-recommendations').addEventListener('click', loadRecommendations);

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
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (response.ok) {
            currentUser = await response.json();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Error loading user:', error);
        logout();
    }
}

function showAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-title');
    const signupFields = document.getElementById('signup-fields');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch-link');

    if (mode === 'login') {
        title.textContent = 'Login';
        signupFields.style.display = 'none';
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Sign up';
        switchLink.onclick = (e) => {
        e.preventDefault();
        showAuthModal('signup');
        };
    } else {
        title.textContent = 'Sign Up';
        signupFields.style.display = 'block';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Login';
        switchLink.onclick = (e) => {
        e.preventDefault();
        showAuthModal('login');
        };
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
    if (title.textContent === 'Login') {
        showAuthModal('signup');
    } else {
        showAuthModal('login');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const title = document.getElementById('auth-title').textContent;

    const isSignup = title === 'Sign Up';
    const endpoint = isSignup ? '/auth/signup' : '/auth/login';
    const body = isSignup ? {
        email,
        password,
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value
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
        showMessage('Network error. Please try again.', 'error');
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
    const grid = document.getElementById('books-grid');
    if (books.length === 0) {
        grid.innerHTML = '<p class="loading">No books found</p>';
        return;
    }

    grid.innerHTML = books.map(book => `
        <div class="book-card">
            <h3>${escapeHtml(book.title)}</h3>
            <p class="author">${book.author || 'Unknown Author'}</p>
            <p class="description">${escapeHtml(book.description || 'No description available')}</p>
            ${book.genres && book.genres.length > 0 ? `
                <div class="genres">
                    ${book.genres.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="book-actions">
                <button class="btn-view" onclick="interactWithBook(${book.id}, 'view')">View</button>
                <button class="btn-like" onclick="interactWithBook(${book.id}, 'like')">Like</button>
                <button class="btn-rate" onclick="rateBook(${book.id})">Rate</button>
            </div>
        </div>
    `).join('');
}

function updatePagination() {
    document.getElementById('page-info').textContent = `Page ${currentPage}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
}

// Recommendations
async function loadRecommendations() {
    if (!authToken) return;

    try {
        const response = await fetch(`${API_BASE_URL}/recommend/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ limit: 20 })
        });

        if (response.ok) {
            const data = await response.json();
            displayBooks(data.recommendations);
        } else {
            const error = await response.json();
            document.getElementById('recommendations-grid').innerHTML = 
                `<p class="loading">${error.detail || 'No recommendations available. Try interacting with some books first!'}</p>`;
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
        showMessage('Error loading recommendations', 'error');
    }
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
        if (prefs.reading_preferences) {
            document.getElementById('pref-reading-prefs').value = prefs.reading_preferences;
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

// Interactions
async function interactWithBook(bookId, type) {
    if (!authToken) {
        showAuthModal('login');
        return;
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

        if (response.ok) {
            showMessage(`Book ${type}d successfully!`, 'success');
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Error recording interaction', 'error');
        }
    } catch (error) {
        console.error('Error recording interaction:', error);
        showMessage('Error recording interaction', 'error');
    }
}

function rateBook(bookId) {
    if (!authToken) {
        showAuthModal('login');
        return;
    }

    const rating = prompt('Rate this book (0-5):');
    if (rating === null) return;

    const ratingNum = parseFloat(rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
        showMessage('Please enter a valid rating between 0 and 5', 'error');
        return;
    }

    fetch(`${API_BASE_URL}/interactions/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            book_id: bookId,
            interaction_type: 'rating',
            rating: ratingNum
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            showMessage('Rating submitted successfully!', 'success');
        } else {
            showMessage(data.detail || 'Error submitting rating', 'error');
        }
    })
    .catch(error => {
        console.error('Error submitting rating:', error);
        showMessage('Error submitting rating', 'error');
    });
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
    const modal = document.getElementById('auth-modal');
    if (event.target === modal) {
        closeAuthModal();
    }
}

