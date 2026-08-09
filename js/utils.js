// Date formatting utilities
export const formatDate = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    }).format(date);
};

export const formatTime = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

// DOM Utilities
export const clearElement = (element) => {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
};

// Simple debounce for search inputs
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
