/* ===================================
   CHRONOS SERVICE WORKER
   Handles background execution, caching, and offline support
   =================================== */

const CACHE_NAME = 'chronos-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// ===================================
// Install Event - Cache Assets
// ===================================
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// ===================================
// Activate Event - Clean Old Caches
// ===================================
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ===================================
// Fetch Event - Serve from Cache
// ===================================
self.addEventListener('fetch', (event) => {
    // Skip chrome-extension and non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request).catch(() => {
                    // If both cache and network fail, return offline page
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// ===================================
// Background Sync for Alarm Checks
// ===================================
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'check-alarms') {
        event.waitUntil(checkAlarms());
    }
});

async function checkAlarms() {
    try {
        // Get alarms from IndexedDB or storage
        const alarms = await getAlarmsFromStorage();
        const now = new Date();
        
        for (const alarm of alarms) {
            if (shouldTriggerAlarm(alarm, now)) {
                await showAlarmNotification(alarm);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Error checking alarms:', error);
    }
}

async function getAlarmsFromStorage() {
    // This would ideally use IndexedDB for more robust storage
    // For now, we'll use a simple approach
    return [];
}

function shouldTriggerAlarm(alarm, currentTime) {
    if (!alarm.enabled) return false;
    
    const alarmTime = new Date();
    alarmTime.setHours(alarm.time.hour, alarm.time.minute, 0, 0);
    
    const timeDiff = Math.abs(alarmTime - currentTime);
    return timeDiff < 60000; // Within 1 minute
}

async function showAlarmNotification(alarm) {
    const title = 'Chronos Alarm';
    const options = {
        body: `${alarm.label} - ${formatTime(alarm.time)}`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23667eea"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23667eea"/></svg>',
        tag: 'chronos-alarm-' + alarm.id,
        requireInteraction: true,
        vibrate: alarm.vibration ? [200, 100, 200, 100, 200] : undefined,
        actions: [
            { action: 'snooze', title: 'Snooze' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        data: { alarmId: alarm.id }
    };
    
    await self.registration.showNotification(title, options);
}

function formatTime(time) {
    const hour = time.hour.toString().padStart(2, '0');
    const minute = time.minute.toString().padStart(2, '0');
    return `${hour}:${minute}`;
}

// ===================================
// Notification Click Handler
// ===================================
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.action);
    
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if ('focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise, open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// ===================================
// Periodic Background Sync (if supported)
// ===================================
self.addEventListener('periodicsync', (event) => {
    console.log('[Service Worker] Periodic sync:', event.tag);
    
    if (event.tag === 'alarm-check') {
        event.waitUntil(checkAlarms());
    }
});

// ===================================
// Message Handler for Communication with App
// ===================================
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CHECK_ALARMS') {
        checkAlarms();
    }
});

// ===================================
// Push Notification Handler (for future enhancement)
// ===================================
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');
    
    if (event.data) {
        const data = event.data.json();
        
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: data.icon,
                tag: data.tag,
                requireInteraction: true
            })
        );
    }
});

console.log('[Service Worker] Loaded');