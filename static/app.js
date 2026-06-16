// Application State
let state = {
    releases: [],
    filteredReleases: [],
    selectedUpdate: null,
    currentFilter: 'all',
    searchQuery: '',
    isLoading: false
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    cacheTime: document.getElementById('cache-time'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    filterPills: document.getElementById('filter-pills'),
    releasesFeed: document.getElementById('releases-feed'),
    releaseGroupsContainer: document.getElementById('release-groups-container'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    
    // Tweet Section
    tweetPlaceholder: document.getElementById('tweet-placeholder'),
    tweetBuilder: document.getElementById('tweet-builder'),
    closeBuilder: document.getElementById('close-builder'),
    previewBadge: document.getElementById('preview-badge'),
    previewDate: document.getElementById('preview-date'),
    previewRawHtml: document.getElementById('preview-raw-html'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    charProgress: document.getElementById('char-progress'),
    charWarning: document.getElementById('char-warning'),
    tweetHashtags: document.getElementById('tweet-hashtags'),
    tweetLink: document.getElementById('tweet-link'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    publishTweetBtn: document.getElementById('publish-tweet-btn'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    toastIcon: document.getElementById('toast-icon')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    setupEventListeners();
    initProgressRing();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Export CSV button
    elements.exportCsvBtn.addEventListener('click', () => {
        exportToCSV();
    });

    // Retry button on error
    elements.retryBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        elements.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        applyFiltersAndSearch();
    });

    // Clear search
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
    });

    // Filter pills
    elements.filterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Update active class
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        state.currentFilter = pill.dataset.filter;
        applyFiltersAndSearch();
    });

    // Close Tweet builder
    elements.closeBuilder.addEventListener('click', () => {
        deselectUpdate();
    });

    // Tweet Textarea change
    elements.tweetTextarea.addEventListener('input', () => {
        updateCharCount();
    });

    // Hashtags change updates the textarea body (only if the body hasn't been edited, otherwise just count characters)
    // Actually, we'll keep the text area content independent, but update the character count if they edit anything.
    elements.tweetHashtags.addEventListener('input', () => {
        regenerateTweetFromInputs();
    });

    // Copy Tweet Button
    elements.copyTweetBtn.addEventListener('click', () => {
        const tweetText = elements.tweetTextarea.value;
        navigator.clipboard.writeText(tweetText)
            .then(() => showToast('Copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy text', 'error'));
    });

    // Publish Tweet Button
    elements.publishTweetBtn.addEventListener('click', () => {
        const tweetText = elements.tweetTextarea.value;
        if (tweetText.length > 280) {
            showToast('Tweet exceeds character limit!', 'error');
            return;
        }
        
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(twitterIntentUrl, '_blank', 'width=550,height=420');
    });
}

// Fetch Releases from API
async function fetchReleases(forceRefresh = false) {
    if (state.isLoading) return;
    
    state.isLoading = true;
    showLoadingState();
    
    // Animate refresh icon
    elements.refreshIcon.classList.add('spinning');
    elements.refreshBtn.disabled = true;

    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            state.releases = result.releases;
            state.filteredReleases = result.releases;
            
            // Update cache/fetch timestamp UI
            if (result.cached_at) {
                const prefix = result.is_fallback ? 'Fallback (Cache: ' : 'Updated: ';
                elements.cacheTime.textContent = `${prefix}${formatTimeString(result.cached_at)}`;
            }
            
            applyFiltersAndSearch();
            showFeedState();
        } else {
            throw new Error(result.error || 'Failed to fetch release notes');
        }
    } catch (error) {
        console.error('Error fetching releases:', error);
        elements.errorMessage.textContent = error.message || 'An error occurred while fetching release notes.';
        showErrorState();
    } finally {
        state.isLoading = false;
        elements.refreshIcon.classList.remove('spinning');
        elements.refreshBtn.disabled = false;
    }
}

// Format time string to be nice
function formatTimeString(timeStr) {
    try {
        // Assume format is YYYY-MM-DD HH:MM:SS
        const parts = timeStr.split(' ');
        if (parts.length === 2) {
            const timeParts = parts[1].split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return timeStr;
    } catch (e) {
        return timeStr;
    }
}

// Filter and Search Logic
function applyFiltersAndSearch() {
    let results = [];
    
    state.releases.forEach(releaseGroup => {
        // Deep copy the release group structure to avoid mutating the original state
        const groupCopy = { ...releaseGroup, updates: [] };
        
        releaseGroup.updates.forEach(update => {
            const matchesFilter = state.currentFilter === 'all' || update.type.toLowerCase() === state.currentFilter.toLowerCase();
            
            const searchLower = state.searchQuery.toLowerCase();
            const matchesSearch = !state.searchQuery || 
                update.text.toLowerCase().includes(searchLower) || 
                update.type.toLowerCase().includes(searchLower) ||
                releaseGroup.date.toLowerCase().includes(searchLower);
                
            if (matchesFilter && matchesSearch) {
                groupCopy.updates.push(update);
            }
        });
        
        if (groupCopy.updates.length > 0) {
            results.push(groupCopy);
        }
    });
    
    state.filteredReleases = results;
    renderFeed();
}

// Render Feed HTML
function renderFeed() {
    elements.releaseGroupsContainer.innerHTML = '';
    
    if (state.filteredReleases.length === 0) {
        elements.emptyState.style.display = 'flex';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    
    state.filteredReleases.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'release-group';
        
        // Group Header
        const headerEl = document.createElement('div');
        headerEl.className = 'group-header';
        
        const dateEl = document.createElement('span');
        dateEl.className = 'group-date';
        dateEl.textContent = group.date;
        
        const lineEl = document.createElement('div');
        lineEl.className = 'group-line';
        
        const linkEl = document.createElement('a');
        linkEl.className = 'group-link';
        linkEl.href = group.link;
        linkEl.target = '_blank';
        linkEl.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> Docs';
        
        headerEl.appendChild(dateEl);
        headerEl.appendChild(lineEl);
        headerEl.appendChild(linkEl);
        groupEl.appendChild(headerEl);
        
        // Group Items
        const itemsEl = document.createElement('div');
        itemsEl.className = 'group-items';
        
        group.updates.forEach(update => {
            const cardEl = document.createElement('div');
            // Class list depends on type
            cardEl.className = `release-card ${update.type}`;
            
            // Check if this card is currently selected
            const isSelected = state.selectedUpdate && 
                state.selectedUpdate.id === group.id && 
                state.selectedUpdate.text === update.text;
                
            if (isSelected) {
                cardEl.classList.add('selected');
            }
            
            // Card Header
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            
            const badge = document.createElement('span');
            badge.className = `badge badge-${update.type.toLowerCase()}`;
            badge.textContent = update.type;
            
            const cardActions = document.createElement('div');
            cardActions.className = 'card-header-actions';
            cardActions.style.display = 'flex';
            cardActions.style.gap = '0.6rem';
            cardActions.style.alignItems = 'center';
            
            const copyIcon = document.createElement('button');
            copyIcon.className = 'card-action-btn copy-card-btn';
            copyIcon.title = 'Copy release note text';
            copyIcon.innerHTML = '<i class="fa-regular fa-copy"></i>';
            copyIcon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card selection
                navigator.clipboard.writeText(update.text)
                    .then(() => showToast('Copied update to clipboard!', 'success'))
                    .catch(() => showToast('Failed to copy', 'error'));
            });

            const checkIcon = document.createElement('span');
            checkIcon.className = 'card-select-indicator';
            checkIcon.innerHTML = isSelected ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-regular fa-circle"></i>';
            
            cardActions.appendChild(copyIcon);
            cardActions.appendChild(checkIcon);
            
            cardHeader.appendChild(badge);
            cardHeader.appendChild(cardActions);
            cardEl.appendChild(cardHeader);
            
            // Card Content
            const cardContent = document.createElement('div');
            cardContent.className = 'card-content';
            cardContent.innerHTML = update.html;
            cardEl.appendChild(cardContent);
            
            // Selection event listener
            cardEl.addEventListener('click', (e) => {
                // Ignore clicks on hyperlinks inside release notes
                if (e.target.tagName === 'A') return;
                
                selectUpdate(group, update);
            });
            
            itemsEl.appendChild(cardEl);
        });
        
        groupEl.appendChild(itemsEl);
        elements.releaseGroupsContainer.appendChild(groupEl);
    });
}

// Select Update to Tweet
function selectUpdate(group, update) {
    state.selectedUpdate = {
        id: group.id,
        date: group.date,
        link: group.link,
        type: update.type,
        html: update.html,
        text: update.text
    };
    
    // Update active classes in DOM without re-rendering everything
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.card-select-indicator').innerHTML = '<i class="fa-regular fa-circle"></i>';
    });
    
    // Find clicked card (need to match based on DOM traverse or similar)
    // Or we can just re-render the feed to keep it clean, but let's do DOM find
    const cards = document.querySelectorAll('.release-card');
    cards.forEach(card => {
        const textContent = card.querySelector('.card-content').textContent;
        // Simple heuristic matching
        if (textContent.includes(update.text.substring(0, 30))) {
            card.classList.add('selected');
            card.querySelector('.card-select-indicator').innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        }
    });

    // Populate Tweet Builder
    elements.previewBadge.className = `badge badge-${update.type.toLowerCase()}`;
    elements.previewBadge.textContent = update.type;
    elements.previewDate.textContent = group.date;
    elements.previewRawHtml.innerHTML = update.html;
    elements.tweetLink.value = group.link;
    
    // Autofill Tweet Area
    generateInitialTweet(group.date, update.type, update.text, group.link);
    
    // Toggle UI States
    elements.tweetPlaceholder.style.display = 'none';
    elements.tweetBuilder.style.display = 'flex';
    
    // Smooth scroll Tweet Builder into view on mobile
    if (window.innerWidth <= 1024) {
        elements.tweetSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Deselect / Close Builder
function deselectUpdate() {
    state.selectedUpdate = null;
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.card-select-indicator').innerHTML = '<i class="fa-regular fa-circle"></i>';
    });
    
    elements.tweetPlaceholder.style.display = 'flex';
    elements.tweetBuilder.style.display = 'none';
}

// Generate Tweet Content
function generateInitialTweet(date, type, text, link) {
    const hashtags = elements.tweetHashtags.value.trim();
    
    // Format date beautifully if possible, e.g. "June 15, 2026"
    const prefix = `BigQuery ${type} (${date}): `;
    const suffix = ` ${hashtags} ${link}`;
    
    // Max length of description body to fit 280 chars
    const reservedLength = prefix.length + suffix.length;
    const maxBodyLength = 280 - reservedLength;
    
    let bodyText = text;
    if (bodyText.length > maxBodyLength) {
        bodyText = bodyText.substring(0, maxBodyLength - 3) + '...';
    }
    
    elements.tweetTextarea.value = `${prefix}${bodyText}${suffix}`;
    updateCharCount();
}

// Regenerate Tweet if Hashtags change
function regenerateTweetFromInputs() {
    if (!state.selectedUpdate) return;
    
    const update = state.selectedUpdate;
    const hashtags = elements.tweetHashtags.value.trim();
    
    const prefix = `BigQuery ${update.type} (${update.date}): `;
    const suffix = ` ${hashtags} ${update.link}`;
    
    const reservedLength = prefix.length + suffix.length;
    const maxBodyLength = 280 - reservedLength;
    
    let bodyText = update.text;
    if (bodyText.length > maxBodyLength) {
        bodyText = bodyText.substring(0, maxBodyLength - 3) + '...';
    }
    
    elements.tweetTextarea.value = `${prefix}${bodyText}${suffix}`;
    updateCharCount();
}

// Progress Circle initialization variables
let ringCircle;
let ringRadius;
let ringCircumference;

function initProgressRing() {
    ringCircle = document.getElementById('char-progress');
    if (!ringCircle) return;
    
    ringRadius = ringCircle.r.baseVal.value;
    ringCircumference = ringRadius * 2 * Math.PI;
    
    ringCircle.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    ringCircle.style.strokeDashoffset = ringCircumference;
}

// Update Character Counter and Ring Progress
function updateCharCount() {
    const text = elements.tweetTextarea.value;
    const len = text.length;
    
    elements.charCounter.textContent = `${len} / 280`;
    
    // Progress Ring updates
    if (ringCircle) {
        const percent = Math.min((len / 280) * 100, 100);
        const offset = ringCircumference - (percent / 100) * ringCircumference;
        ringCircle.style.strokeDashoffset = offset;
        
        // Progress colors
        if (len > 280) {
            ringCircle.style.stroke = '#ef4444'; // Red
            elements.charCounter.className = 'char-count error';
            elements.charWarning.style.display = 'block';
        } else if (len > 250) {
            ringCircle.style.stroke = '#f59e0b'; // Amber warning
            elements.charCounter.className = 'char-count warning';
            elements.charWarning.style.display = 'none';
        } else {
            ringCircle.style.stroke = '#3b82f6'; // Blue default
            elements.charCounter.className = 'char-count';
            elements.charWarning.style.display = 'none';
        }
    }
}

// UI State Switchers
function showLoadingState() {
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.releaseGroupsContainer.style.display = 'none';
}

function showFeedState() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.releaseGroupsContainer.style.display = 'block';
}

function showErrorState() {
    elements.loadingState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.releaseGroupsContainer.style.display = 'none';
    elements.errorState.style.display = 'flex';
}

// Toast System
let toastTimeout;
function showToast(message, type = 'success') {
    clearTimeout(toastTimeout);
    
    elements.toastMessage.textContent = message;
    elements.toast.className = 'toast show';
    
    if (type === 'error') {
        elements.toast.classList.add('error');
        elements.toastIcon.className = 'fa-solid fa-triangle-exclamation';
    } else {
        elements.toastIcon.className = 'fa-solid fa-check-circle';
    }
    
    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Export visible/filtered releases to CSV format
function exportToCSV() {
    if (state.filteredReleases.length === 0) {
        showToast('No releases available to export', 'error');
        return;
    }

    const headers = ['Date', 'Type', 'Link', 'Update Description'];
    const rows = [headers];

    state.filteredReleases.forEach(group => {
        group.updates.forEach(update => {
            const cleanDate = group.date.replace(/"/g, '""');
            const cleanType = update.type.replace(/"/g, '""');
            const cleanLink = group.link.replace(/"/g, '""');
            const cleanText = update.text.replace(/"/g, '""');

            rows.push([
                `"${cleanDate}"`,
                `"${cleanType}"`,
                `"${cleanLink}"`,
                `"${cleanText}"`
            ]);
        });
    });

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV downloaded successfully!', 'success');
    }
}
