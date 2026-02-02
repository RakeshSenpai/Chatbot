/* ===================================
   CHRONOS ALARM CLOCK APPLICATION
   Modern PWA with Background Execution
   =================================== */

// ===================================
// Configuration & Constants
// ===================================
const CONFIG = {
    STORAGE_KEY: 'chronos_alarms',
    SETTINGS_KEY: 'chronos_settings',
    SNOOZE_DEFAULT: 5,
    VOLUME_RAMP_DURATION: 10000, // 10 seconds
    VOLUME_RAMP_STEPS: 20,
    CHECK_INTERVAL: 1000, // Check every second
    NOTIFICATION_TAG: 'chronos-alarm',
};

// ===================================
// Alarm Data Structure
// ===================================
class Alarm {
    constructor(data = {}) {
        this.id = data.id || Date.now().toString();
        this.time = data.time || { hour: 7, minute: 0 };
        this.label = data.label || 'Wake up';
        this.enabled = data.enabled !== undefined ? data.enabled : true;
        this.repeat = data.repeat || 'once'; // 'once', 'daily', 'custom'
        this.weekdays = data.weekdays || []; // [0-6] for custom repeat
        this.sound = data.sound || 'default';
        this.customSoundData = data.customSoundData || null;
        this.snoozeDuration = data.snoozeDuration || CONFIG.SNOOZE_DEFAULT;
        this.vibration = data.vibration !== undefined ? data.vibration : true;
        this.gradualVolume = data.gradualVolume !== undefined ? data.gradualVolume : true;
        this.snoozedUntil = data.snoozedUntil || null;
    }

    toJSON() {
        return {
            id: this.id,
            time: this.time,
            label: this.label,
            enabled: this.enabled,
            repeat: this.repeat,
            weekdays: this.weekdays,
            sound: this.sound,
            customSoundData: this.customSoundData,
            snoozeDuration: this.snoozeDuration,
            vibration: this.vibration,
            gradualVolume: this.gradualVolume,
            snoozedUntil: this.snoozedUntil
        };
    }

    getNextTriggerTime() {
        const now = new Date();
        const alarm = new Date();
        alarm.setHours(this.time.hour, this.time.minute, 0, 0);

        // If snoozed, use snooze time
        if (this.snoozedUntil) {
            const snoozeTime = new Date(this.snoozedUntil);
            if (snoozeTime > now) {
                return snoozeTime;
            }
            this.snoozedUntil = null;
        }

        // If time has passed today, move to tomorrow for once/daily
        if (alarm <= now && (this.repeat === 'once' || this.repeat === 'daily')) {
            alarm.setDate(alarm.getDate() + 1);
        }

        // For custom repeat, find next valid day
        if (this.repeat === 'custom') {
            while (alarm <= now || !this.weekdays.includes(alarm.getDay())) {
                alarm.setDate(alarm.getDate() + 1);
            }
        }

        return alarm;
    }

    shouldTrigger(currentTime = new Date()) {
        if (!this.enabled) return false;

        const triggerTime = this.getNextTriggerTime();
        const timeDiff = Math.abs(triggerTime - currentTime);

        // Trigger if within 1 second of alarm time
        return timeDiff < 1000;
    }
}

// ===================================
// Storage Manager
// ===================================
class StorageManager {
    static save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Storage error:', error);
            return false;
        }
    }

    static load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Storage error:', error);
            return null;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage error:', error);
            return false;
        }
    }
}

// ===================================
// Sound Manager
// ===================================
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.currentSource = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.sounds = this.generateSounds();
    }

    // Generate alarm sounds using Web Audio API
    generateSounds() {
        return {
            default: this.createDefaultAlarm,
            gentle: this.createGentleChimes,
            radar: this.createRadarSound,
            bell: this.createBellSound
        };
    }

    async initialize() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
        }
        
        // Resume context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    createDefaultAlarm(context, duration = 0.5) {
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        const gainNode = context.createGain();

        osc1.frequency.value = 1000;
        osc2.frequency.value = 1200;
        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(context.destination);

        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

        osc1.start(context.currentTime);
        osc2.start(context.currentTime);
        osc1.stop(context.currentTime + duration);
        osc2.stop(context.currentTime + duration);

        return { stop: () => { osc1.stop(); osc2.stop(); } };
    }

    createGentleChimes(context, duration = 1) {
        const frequencies = [523.25, 659.25, 783.99]; // C, E, G
        const oscillators = [];

        frequencies.forEach((freq, index) => {
            const osc = context.createOscillator();
            const gainNode = context.createGain();
            
            osc.frequency.value = freq;
            osc.type = 'sine';
            osc.connect(gainNode);
            gainNode.connect(context.destination);

            const startTime = context.currentTime + (index * 0.2);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
            oscillators.push(osc);
        });

        return { stop: () => oscillators.forEach(osc => osc.stop()) };
    }

    createRadarSound(context, duration = 0.3) {
        const osc = context.createOscillator();
        const gainNode = context.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, context.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(context.destination);

        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

        osc.start(context.currentTime);
        osc.stop(context.currentTime + duration);

        return { stop: () => osc.stop() };
    }

    createBellSound(context, duration = 2) {
        const frequencies = [440, 880, 1320, 1760];
        const oscillators = [];

        frequencies.forEach((freq, index) => {
            const osc = context.createOscillator();
            const gainNode = context.createGain();
            
            osc.frequency.value = freq;
            osc.type = 'sine';
            osc.connect(gainNode);
            gainNode.connect(context.destination);

            const volume = 0.15 / (index + 1);
            gainNode.gain.setValueAtTime(volume, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

            osc.start(context.currentTime);
            osc.stop(context.currentTime + duration);
            oscillators.push(osc);
        });

        return { stop: () => oscillators.forEach(osc => osc.stop()) };
    }

    async play(soundType = 'default', customData = null, gradualVolume = true) {
        await this.initialize();
        this.stop(); // Stop any currently playing sound

        this.isPlaying = true;

        if (customData) {
            // Play custom uploaded sound
            this.playCustomSound(customData, gradualVolume);
        } else {
            // Play generated sound
            this.playGeneratedSound(soundType, gradualVolume);
        }
    }

    playGeneratedSound(soundType, gradualVolume) {
        const soundGenerator = this.sounds[soundType] || this.sounds.default;
        
        // Loop the sound
        const playSound = () => {
            if (!this.isPlaying) return;
            
            soundGenerator.call(this, this.audioContext, 1);
            
            setTimeout(playSound, 1000); // Repeat every second
        };

        if (gradualVolume) {
            this.applyGradualVolume();
        } else {
            this.gainNode.gain.value = 1.0;
        }

        playSound();
    }

    async playCustomSound(customData, gradualVolume) {
        try {
            const audioBuffer = await this.audioContext.decodeAudioData(customData);
            
            const playSound = () => {
                if (!this.isPlaying) return;

                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.gainNode);
                source.onended = () => {
                    if (this.isPlaying) {
                        setTimeout(playSound, 100);
                    }
                };
                source.start(0);
                this.currentSource = source;
            };

            if (gradualVolume) {
                this.applyGradualVolume();
            } else {
                this.gainNode.gain.value = 1.0;
            }

            playSound();
        } catch (error) {
            console.error('Error playing custom sound:', error);
            this.playGeneratedSound('default', gradualVolume);
        }
    }

    applyGradualVolume() {
        const startVolume = 0.1;
        const endVolume = 1.0;
        const rampDuration = CONFIG.VOLUME_RAMP_DURATION / 1000; // Convert to seconds

        this.gainNode.gain.setValueAtTime(startVolume, this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(
            endVolume,
            this.audioContext.currentTime + rampDuration
        );
    }

    stop() {
        this.isPlaying = false;
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Source might already be stopped
            }
            this.currentSource = null;
        }
        if (this.gainNode) {
            this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        }
    }
}

// ===================================
// Notification Manager
// ===================================
class NotificationManager {
    static async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    static hasPermission() {
        return 'Notification' in window && Notification.permission === 'granted';
    }

    static show(alarm) {
        if (!this.hasPermission()) return;

        const notification = new Notification('Chronos Alarm', {
            body: `${alarm.label} - ${this.formatTime(alarm.time)}`,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23667eea"/></svg>',
            tag: CONFIG.NOTIFICATION_TAG,
            requireInteraction: true,
            vibrate: alarm.vibration ? [200, 100, 200, 100, 200] : undefined
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        return notification;
    }

    static formatTime(time) {
        const hour = time.hour.toString().padStart(2, '0');
        const minute = time.minute.toString().padStart(2, '0');
        return `${hour}:${minute}`;
    }

    static close() {
        // Close any existing notifications
        if ('Notification' in window) {
            // This is a browser limitation - we can only close notifications we created
            // Service worker notifications would persist
        }
    }
}

// ===================================
// Vibration Manager
// ===================================
class VibrationManager {
    static vibrate(pattern = [500, 200, 500, 200, 500]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
            return true;
        }
        return false;
    }

    static stop() {
        if ('vibrate' in navigator) {
            navigator.vibrate(0);
        }
    }

    static startContinuous() {
        this.vibrateInterval = setInterval(() => {
            this.vibrate();
        }, 3000);
    }

    static stopContinuous() {
        if (this.vibrateInterval) {
            clearInterval(this.vibrateInterval);
            this.vibrateInterval = null;
        }
        this.stop();
    }
}

// ===================================
// Wake Lock Manager (Keep screen on)
// ===================================
class WakeLockManager {
    constructor() {
        this.wakeLock = null;
        this.enabled = true;
    }

    async request() {
        if (!this.enabled) return;

        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });

                console.log('Wake Lock activated');
            }
        } catch (error) {
            console.error('Wake Lock error:', error);
        }
    }

    async release() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                this.wakeLock = null;
            } catch (error) {
                console.error('Wake Lock release error:', error);
            }
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.release();
        }
    }
}

// ===================================
// Alarm Manager (Core Logic)
// ===================================
class AlarmManager {
    constructor() {
        this.alarms = [];
        this.currentAlarm = null;
        this.checkInterval = null;
        this.soundManager = new SoundManager();
        this.wakeLockManager = new WakeLockManager();
        
        this.loadAlarms();
        this.startChecking();
    }

    loadAlarms() {
        const data = StorageManager.load(CONFIG.STORAGE_KEY);
        if (data && Array.isArray(data)) {
            this.alarms = data.map(alarmData => new Alarm(alarmData));
        }
    }

    saveAlarms() {
        const data = this.alarms.map(alarm => alarm.toJSON());
        StorageManager.save(CONFIG.STORAGE_KEY, data);
    }

    addAlarm(alarmData) {
        const alarm = new Alarm(alarmData);
        this.alarms.push(alarm);
        this.saveAlarms();
        this.scheduleNotification(alarm);
        return alarm;
    }

    updateAlarm(id, alarmData) {
        const index = this.alarms.findIndex(a => a.id === id);
        if (index !== -1) {
            this.alarms[index] = new Alarm({ ...alarmData, id });
            this.saveAlarms();
            this.scheduleNotification(this.alarms[index]);
            return this.alarms[index];
        }
        return null;
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        this.saveAlarms();
        this.cancelNotification(id);
    }

    toggleAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = !alarm.enabled;
            this.saveAlarms();
            
            if (alarm.enabled) {
                this.scheduleNotification(alarm);
            } else {
                this.cancelNotification(id);
            }
        }
        return alarm;
    }

    getAlarms() {
        return this.alarms;
    }

    getAlarm(id) {
        return this.alarms.find(a => a.id === id);
    }

    startChecking() {
        // Check for alarms every second
        this.checkInterval = setInterval(() => {
            this.checkAlarms();
        }, CONFIG.CHECK_INTERVAL);

        // Also check immediately
        this.checkAlarms();
    }

    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    checkAlarms() {
        const now = new Date();
        
        for (const alarm of this.alarms) {
            if (alarm.shouldTrigger(now)) {
                this.triggerAlarm(alarm);
                
                // Disable one-time alarms after triggering
                if (alarm.repeat === 'once') {
                    alarm.enabled = false;
                    this.saveAlarms();
                }
            }
        }
    }

    async triggerAlarm(alarm) {
        console.log('Triggering alarm:', alarm.label);
        
        this.currentAlarm = alarm;
        
        // Request wake lock
        await this.wakeLockManager.request();
        
        // Play sound
        await this.soundManager.play(alarm.sound, alarm.customSoundData, alarm.gradualVolume);
        
        // Vibrate
        if (alarm.vibration) {
            VibrationManager.startContinuous();
        }
        
        // Show notification
        NotificationManager.show(alarm);
        
        // Show alarm screen
        UI.showAlarmScreen(alarm);
    }

    snoozeAlarm() {
        if (!this.currentAlarm) return;

        const snoozeMinutes = this.currentAlarm.snoozeDuration;
        const snoozeTime = new Date();
        snoozeTime.setMinutes(snoozeTime.getMinutes() + snoozeMinutes);
        
        this.currentAlarm.snoozedUntil = snoozeTime.toISOString();
        this.saveAlarms();
        
        this.dismissAlarm();
    }

    dismissAlarm() {
        // Stop sound
        this.soundManager.stop();
        
        // Stop vibration
        VibrationManager.stopContinuous();
        
        // Release wake lock
        this.wakeLockManager.release();
        
        // Close notification
        NotificationManager.close();
        
        // Hide alarm screen
        UI.hideAlarmScreen();
        
        this.currentAlarm = null;
    }

    // Service Worker integration for background execution
    async scheduleNotification(alarm) {
        if ('serviceWorker' in navigator && alarm.enabled) {
            try {
                const registration = await navigator.serviceWorker.ready;
                // Note: Notification scheduling is limited in browsers
                // This is a placeholder for future Notification Triggers API
                console.log('Alarm scheduled:', alarm.label);
            } catch (error) {
                console.error('Error scheduling notification:', error);
            }
        }
    }

    cancelNotification(alarmId) {
        console.log('Alarm notification cancelled:', alarmId);
    }
}

// ===================================
// UI Manager
// ===================================
class UI {
    static init() {
        this.initElements();
        this.attachEventListeners();
        this.updateCurrentTime();
        this.renderAlarms();
        this.loadSettings();
        
        // Update time every second
        setInterval(() => this.updateCurrentTime(), 1000);
    }

    static initElements() {
        // Cache DOM elements
        this.elements = {
            currentTime: document.getElementById('currentTime'),
            currentDate: document.getElementById('currentDate'),
            alarmsList: document.getElementById('alarmsList'),
            emptyState: document.getElementById('emptyState'),
            addAlarmBtn: document.getElementById('addAlarmBtn'),
            alarmModal: document.getElementById('alarmModal'),
            settingsModal: document.getElementById('settingsModal'),
            alarmForm: document.getElementById('alarmForm'),
            alarmRingingScreen: document.getElementById('alarmRingingScreen'),
            themeToggle: document.getElementById('themeToggle'),
            settingsBtn: document.getElementById('settingsBtn'),
        };
    }

    static attachEventListeners() {
        // Add alarm button
        this.elements.addAlarmBtn.addEventListener('click', () => this.openAlarmModal());

        // Settings button
        this.elements.settingsBtn.addEventListener('click', () => this.openSettingsModal());

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        // Modal overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                overlay.closest('.modal').classList.remove('active');
            });
        });

        // Alarm form
        this.elements.alarmForm.addEventListener('submit', (e) => this.handleAlarmSubmit(e));

        // Repeat buttons
        document.querySelectorAll('.repeat-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleRepeatChange(btn));
        });

        // Weekday buttons
        document.querySelectorAll('.weekday-btn').forEach(btn => {
            btn.addEventListener('click', () => btn.classList.toggle('active'));
        });

        // Sound select
        document.getElementById('soundSelect').addEventListener('change', (e) => {
            const customGroup = document.getElementById('customSoundGroup');
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Time inputs
        this.setupTimeInputs();

        // Alarm ringing controls
        document.getElementById('snoozeBtn').addEventListener('click', () => {
            app.alarmManager.snoozeAlarm();
        });

        document.getElementById('dismissBtn').addEventListener('click', () => {
            app.alarmManager.dismissAlarm();
        });

        // Settings
        document.getElementById('timeFormatToggle').addEventListener('change', (e) => {
            this.saveSettings({ use24Hour: e.target.checked });
            this.updateCurrentTime();
        });

        document.getElementById('wakeLockToggle').addEventListener('change', (e) => {
            app.alarmManager.wakeLockManager.setEnabled(e.target.checked);
            this.saveSettings({ wakeLock: e.target.checked });
        });

        document.getElementById('requestNotificationBtn').addEventListener('click', async () => {
            const granted = await NotificationManager.requestPermission();
            this.updateNotificationStatus();
            if (granted) {
                alert('Notifications enabled successfully!');
            }
        });

        document.getElementById('testAlarmBtn').addEventListener('click', () => {
            this.testAlarm();
        });
    }

    static setupTimeInputs() {
        const hourInput = document.getElementById('hourInput');
        const minuteInput = document.getElementById('minuteInput');

        // Format on blur
        [hourInput, minuteInput].forEach(input => {
            input.addEventListener('blur', (e) => {
                const value = parseInt(e.target.value) || 0;
                const max = e.target === hourInput ? 23 : 59;
                e.target.value = Math.min(Math.max(value, 0), max).toString().padStart(2, '0');
            });

            // Allow arrow keys to increment/decrement
            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const value = parseInt(e.target.value) || 0;
                    const max = e.target === hourInput ? 23 : 59;
                    e.target.value = ((value + 1) % (max + 1)).toString().padStart(2, '0');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const value = parseInt(e.target.value) || 0;
                    const max = e.target === hourInput ? 23 : 59;
                    e.target.value = ((value - 1 + max + 1) % (max + 1)).toString().padStart(2, '0');
                }
            });
        });
    }

    static updateCurrentTime() {
        const now = new Date();
        const settings = this.getSettings();
        
        // Time
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        let timeStr;
        if (settings.use24Hour) {
            timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else {
            const displayHours = hours % 12 || 12;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        }
        
        this.elements.currentTime.textContent = timeStr;
        
        // Date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.elements.currentDate.textContent = now.toLocaleDateString('en-US', options);
    }

    static renderAlarms() {
        const alarms = app.alarmManager.getAlarms();
        
        if (alarms.length === 0) {
            this.elements.emptyState.classList.add('visible');
            this.elements.alarmsList.innerHTML = '';
            return;
        }
        
        this.elements.emptyState.classList.remove('visible');
        
        this.elements.alarmsList.innerHTML = alarms.map(alarm => this.createAlarmCard(alarm)).join('');
        
        // Attach event listeners to cards
        this.attachAlarmCardListeners();
    }

    static createAlarmCard(alarm) {
        const settings = this.getSettings();
        let timeStr;
        
        if (settings.use24Hour) {
            timeStr = `${alarm.time.hour.toString().padStart(2, '0')}:${alarm.time.minute.toString().padStart(2, '0')}`;
        } else {
            const displayHours = alarm.time.hour % 12 || 12;
            const ampm = alarm.time.hour >= 12 ? 'PM' : 'AM';
            timeStr = `${displayHours}:${alarm.time.minute.toString().padStart(2, '0')} ${ampm}`;
        }
        
        let repeatStr = '';
        if (alarm.repeat === 'daily') {
            repeatStr = 'Every day';
        } else if (alarm.repeat === 'custom') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            repeatStr = alarm.weekdays.map(d => days[d]).join(', ');
        } else {
            const next = alarm.getNextTriggerTime();
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            if (next.toDateString() === today.toDateString()) {
                repeatStr = 'Today';
            } else if (next.toDateString() === tomorrow.toDateString()) {
                repeatStr = 'Tomorrow';
            } else {
                repeatStr = next.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            }
        }
        
        return `
            <div class="alarm-card ${alarm.enabled ? '' : 'disabled'}" data-id="${alarm.id}">
                <div class="alarm-info">
                    <div class="alarm-time-display">${timeStr}</div>
                    <div class="alarm-label-display">${alarm.label}</div>
                    <div class="alarm-repeat-display">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="17 1 21 5 17 9"></polyline>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                            <polyline points="7 23 3 19 7 15"></polyline>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                        </svg>
                        <span>${repeatStr}</span>
                    </div>
                </div>
                <div class="alarm-controls">
                    <label class="toggle-switch">
                        <input type="checkbox" ${alarm.enabled ? 'checked' : ''} data-action="toggle">
                        <span class="toggle-slider"></span>
                    </label>
                    <button class="delete-btn" data-action="delete" aria-label="Delete alarm">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    static attachAlarmCardListeners() {
        document.querySelectorAll('.alarm-card').forEach(card => {
            const alarmId = card.dataset.id;
            
            // Click on info to edit
            card.querySelector('.alarm-info').addEventListener('click', () => {
                this.openAlarmModal(alarmId);
            });
            
            // Toggle alarm
            const toggle = card.querySelector('[data-action="toggle"]');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                app.alarmManager.toggleAlarm(alarmId);
                this.renderAlarms();
            });
            
            // Delete alarm
            const deleteBtn = card.querySelector('[data-action="delete"]');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this alarm?')) {
                    app.alarmManager.deleteAlarm(alarmId);
                    this.renderAlarms();
                }
            });
        });
    }

    static openAlarmModal(alarmId = null) {
        const modal = this.elements.alarmModal;
        const form = this.elements.alarmForm;
        const title = document.getElementById('modalTitle');
        
        // Reset form
        form.reset();
        document.getElementById('hourInput').value = '07';
        document.getElementById('minuteInput').value = '00';
        document.getElementById('snoozeInput').value = CONFIG.SNOOZE_DEFAULT;
        document.getElementById('vibrationCheck').checked = true;
        document.getElementById('gradualVolumeCheck').checked = true;
        document.querySelectorAll('.repeat-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-repeat="once"]').classList.add('active');
        document.getElementById('weekdaysGroup').style.display = 'none';
        document.getElementById('customSoundGroup').style.display = 'none';
        
        if (alarmId) {
            // Edit mode
            title.textContent = 'Edit Alarm';
            const alarm = app.alarmManager.getAlarm(alarmId);
            
            if (alarm) {
                document.getElementById('hourInput').value = alarm.time.hour.toString().padStart(2, '0');
                document.getElementById('minuteInput').value = alarm.time.minute.toString().padStart(2, '0');
                document.getElementById('labelInput').value = alarm.label;
                document.getElementById('soundSelect').value = alarm.sound;
                document.getElementById('snoozeInput').value = alarm.snoozeDuration;
                document.getElementById('vibrationCheck').checked = alarm.vibration;
                document.getElementById('gradualVolumeCheck').checked = alarm.gradualVolume;
                
                // Set repeat
                document.querySelectorAll('.repeat-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector(`[data-repeat="${alarm.repeat}"]`).classList.add('active');
                
                if (alarm.repeat === 'custom') {
                    document.getElementById('weekdaysGroup').style.display = 'block';
                    document.querySelectorAll('.weekday-btn').forEach((btn, index) => {
                        btn.classList.toggle('active', alarm.weekdays.includes(index));
                    });
                }
                
                if (alarm.sound === 'custom') {
                    document.getElementById('customSoundGroup').style.display = 'block';
                }
                
                form.dataset.editId = alarmId;
            }
        } else {
            // Add mode
            title.textContent = 'New Alarm';
            delete form.dataset.editId;
        }
        
        modal.classList.add('active');
    }

    static handleRepeatChange(btn) {
        document.querySelectorAll('.repeat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const repeat = btn.dataset.repeat;
        const weekdaysGroup = document.getElementById('weekdaysGroup');
        weekdaysGroup.style.display = repeat === 'custom' ? 'block' : 'none';
    }

    static async handleAlarmSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const editId = form.dataset.editId;
        
        // Get form data
        const hour = parseInt(document.getElementById('hourInput').value);
        const minute = parseInt(document.getElementById('minuteInput').value);
        const label = document.getElementById('labelInput').value || 'Wake up';
        const repeat = document.querySelector('.repeat-btn.active').dataset.repeat;
        const sound = document.getElementById('soundSelect').value;
        const snoozeDuration = parseInt(document.getElementById('snoozeInput').value);
        const vibration = document.getElementById('vibrationCheck').checked;
        const gradualVolume = document.getElementById('gradualVolumeCheck').checked;
        
        let weekdays = [];
        if (repeat === 'custom') {
            weekdays = Array.from(document.querySelectorAll('.weekday-btn.active'))
                .map(btn => parseInt(btn.dataset.day));
            
            if (weekdays.length === 0) {
                alert('Please select at least one day');
                return;
            }
        }
        
        // Handle custom sound
        let customSoundData = null;
        if (sound === 'custom') {
            const fileInput = document.getElementById('customSound');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const arrayBuffer = await file.arrayBuffer();
                customSoundData = arrayBuffer;
            }
        }
        
        const alarmData = {
            time: { hour, minute },
            label,
            repeat,
            weekdays,
            sound,
            customSoundData,
            snoozeDuration,
            vibration,
            gradualVolume
        };
        
        if (editId) {
            app.alarmManager.updateAlarm(editId, alarmData);
        } else {
            app.alarmManager.addAlarm(alarmData);
        }
        
        this.elements.alarmModal.classList.remove('active');
        this.renderAlarms();
    }

    static openSettingsModal() {
        this.elements.settingsModal.classList.add('active');
        this.updateNotificationStatus();
    }

    static updateNotificationStatus() {
        const statusEl = document.getElementById('notificationStatus');
        const btnEl = document.getElementById('requestNotificationBtn');
        
        if (NotificationManager.hasPermission()) {
            statusEl.textContent = 'Granted';
            statusEl.style.color = 'var(--success)';
            btnEl.style.display = 'none';
        } else {
            statusEl.textContent = 'Not granted';
            statusEl.style.color = 'var(--text-muted)';
            btnEl.style.display = 'block';
        }
    }

    static toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        this.saveSettings({ theme: newTheme });
    }

    static showAlarmScreen(alarm) {
        const screen = this.elements.alarmRingingScreen;
        const settings = this.getSettings();
        
        let timeStr;
        if (settings.use24Hour) {
            timeStr = `${alarm.time.hour.toString().padStart(2, '0')}:${alarm.time.minute.toString().padStart(2, '0')}`;
        } else {
            const displayHours = alarm.time.hour % 12 || 12;
            const ampm = alarm.time.hour >= 12 ? 'PM' : 'AM';
            timeStr = `${displayHours}:${alarm.time.minute.toString().padStart(2, '0')} ${ampm}`;
        }
        
        document.getElementById('alarmTime').textContent = timeStr;
        document.getElementById('alarmLabel').textContent = alarm.label;
        
        screen.classList.add('active');
    }

    static hideAlarmScreen() {
        this.elements.alarmRingingScreen.classList.remove('active');
    }

    static testAlarm() {
        const testAlarm = new Alarm({
            time: { hour: new Date().getHours(), minute: new Date().getMinutes() },
            label: 'Test Alarm',
            sound: 'default',
            vibration: true,
            gradualVolume: false
        });
        
        app.alarmManager.triggerAlarm(testAlarm);
        
        // Auto dismiss after 10 seconds
        setTimeout(() => {
            if (app.alarmManager.currentAlarm === testAlarm) {
                app.alarmManager.dismissAlarm();
            }
        }, 10000);
        
        this.elements.settingsModal.classList.remove('active');
    }

    static getSettings() {
        const defaults = {
            theme: 'dark',
            use24Hour: false,
            wakeLock: true
        };
        
        const saved = StorageManager.load(CONFIG.SETTINGS_KEY);
        return { ...defaults, ...saved };
    }

    static saveSettings(settings) {
        const current = this.getSettings();
        const updated = { ...current, ...settings };
        StorageManager.save(CONFIG.SETTINGS_KEY, updated);
    }

    static loadSettings() {
        const settings = this.getSettings();
        
        // Apply theme
        document.documentElement.setAttribute('data-theme', settings.theme);
        
        // Apply settings to UI
        document.getElementById('timeFormatToggle').checked = settings.use24Hour;
        document.getElementById('wakeLockToggle').checked = settings.wakeLock;
        
        // Apply wake lock setting
        app.alarmManager.wakeLockManager.setEnabled(settings.wakeLock);
    }
}

// ===================================
// Application Bootstrap
// ===================================
class App {
    constructor() {
        this.alarmManager = new AlarmManager();
        this.init();
    }

    async init() {
        // Initialize UI
        UI.init();
        
        // Request notification permission on first load
        if (!NotificationManager.hasPermission()) {
            setTimeout(() => {
                if (confirm('Allow Chronos to send notifications for alarms?')) {
                    NotificationManager.requestPermission();
                }
            }, 2000);
        }
        
        // Register service worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
        
        // Handle visibility change (reactivate checking when app becomes visible)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.alarmManager.checkAlarms();
            }
        });
        
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.alarmManager.saveAlarms();
        });
    }
}

// Initialize the application
const app = new App();