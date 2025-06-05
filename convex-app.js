// Camisflow - Working Convex Integration
console.log('🚀 Camisflow with Convex starting...');

let currentUser = null;
let convexClient = null;
const CONVEX_URL = 'https://confident-wolf-659.convex.cloud';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 DOM ready, connecting to Convex...');
    
    try {
        // Create Convex client
        convexClient = new Convex(CONVEX_URL);
        console.log('✅ Convex client created!');
        
        // Test the connection
        console.log('🧪 Testing connection...');
        await testConnection();
        
        // Setup UI first
        setupEventListeners();
        
        // Then check for saved user (after Convex is ready)
        await checkSavedUser();
        
    } catch (error) {
        console.error('❌ Convex initialization failed:', error);
        alert('Failed to connect to cloud database. Please refresh.');
    }
});

async function testConnection() {
    try {
        // Try to get users to test connection
        const result = await convexClient.query('users:getUserByAccessCode', { accessCode: '222' });
        console.log('✅ Connection successful!');
        
        // If no user found, create them
        if (!result) {
            await createInitialUsers();
        }
    } catch (error) {
        console.log('⚠️ Creating initial users...');
        await createInitialUsers();
    }
}

async function createInitialUsers() {
    try {
        // Create admin user
        await convexClient.mutation('users:createUser', {
            id: 'cami',
            name: 'Cami',
            email: 'cami@example.com',
            role: 'admin',
            accessCode: '222'
        });
        
        // Create viewer user  
        await convexClient.mutation('users:createUser', {
            id: 'viewer',
            name: 'Viewer', 
            email: 'viewer@example.com',
            role: 'viewer',
            accessCode: '444'
        });
        
        console.log('✅ Initial users created!');
    } catch (error) {
        console.log('ℹ️ Users might already exist:', error.message);
    }
}

async function checkSavedUser() {
    const saved = localStorage.getItem('camisflow-current-user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            console.log('👤 Found saved user:', currentUser.name);
            
            // Verify user still exists in Convex
            const verifiedUser = await convexClient.query('users:getUserByAccessCode', { 
                accessCode: currentUser.accessCode 
            });
            
            if (verifiedUser) {
                console.log('✅ User verified in cloud');
                currentUser = verifiedUser; // Update with latest data
                localStorage.setItem('camisflow-current-user', JSON.stringify(verifiedUser));
                showMainApp();
                await loadDashboard();
            } else {
                console.log('⚠️ Saved user no longer valid, logging out');
                logout();
            }
        } catch (error) {
            console.error('❌ Error verifying saved user:', error);
            logout();
        }
            } else {
            console.log('🔐 No saved user, showing login');
            showLoginPage();
        }
}

async function handleLogin() {
    const code = document.getElementById('loginCode').value;
    console.log('🔐 Login attempt with code:', code);
    
    try {
        const user = await convexClient.query('users:getUserByAccessCode', { accessCode: code });
        
        if (user) {
            currentUser = user;
            localStorage.setItem('camisflow-current-user', JSON.stringify(user));
            console.log('✅ Login successful for:', user.name);
            
            hideLoginPage();
            showMainApp();
            await loadDashboard();
        } else {
            alert('Invalid access code. Use 222 for admin or 444 for viewer.');
        }
    } catch (error) {
        console.error('❌ Login failed:', error);
        alert('Login failed. Please try again.');
    }
}

async function handlePeriodStart() {
    if (!currentUser || currentUser.role !== 'admin') {
        console.log('⚠️ Admin access required');
        return;
    }
    
    console.log('🩸 Logging period start...');
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        await convexClient.mutation('cycle:logCycle', {
            userId: currentUser._id,
            date: today,
            phase: 'period',
            actualStart: true
        });
        
        console.log('✅ Period logged to cloud!');
        await loadDashboard();
        
    } catch (error) {
        console.error('❌ Failed to log period:', error);
        alert('Failed to save period data.');
    }
}

async function handleMoodClick(mood) {
    if (!currentUser || currentUser.role !== 'admin') {
        console.log('⚠️ Admin access required');
        return;
    }
    
    console.log('😊 Logging mood:', mood);
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        await convexClient.mutation('moods:logMood', {
            userId: currentUser._id,
            date: today,
            mood: mood
        });
        
        console.log('✅ Mood saved to cloud!');
        await showCurrentMood();
        
    } catch (error) {
        console.error('❌ Failed to log mood:', error);
        alert('Failed to save mood data.');
    }
}

async function loadDashboard() {
    console.log('📊 Loading dashboard from cloud...');
    
    try {
        // Get cycle data
        const cycles = await convexClient.query('cycle:getCycleLogs', { userId: currentUser._id });
        console.log('🔄 Loaded', cycles.length, 'cycle entries');
        
        updateCycleDisplay(cycles);
        await showCurrentMood();
        
    } catch (error) {
        console.error('❌ Failed to load dashboard:', error);
    }
}

function updateCycleDisplay(cycles) {
    // Find most recent actual period start
    const periodStarts = cycles.filter(c => c.actualStart && c.phase === 'period');
    
    if (periodStarts.length > 0) {
        const latest = periodStarts[periodStarts.length - 1];
        const startDate = new Date(latest.date);
        const today = new Date();
        const daysSince = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const cycleDay = daysSince + 1;
        
        const cycleText = document.getElementById('cycleText');
        const cycleSubtext = document.getElementById('cycleSubtext');
        
        if (cycleDay <= 5) {
            cycleText.textContent = `Period Day ${cycleDay}`;
            cycleSubtext.textContent = `${Math.max(0, 6 - cycleDay)} days remaining`;
        } else {
            const nextPeriod = 28 - cycleDay + 1;
            cycleText.textContent = `Period in ${nextPeriod} days`;
            cycleSubtext.textContent = `Day ${cycleDay} of 28`;
        }
        
        console.log('📅 Cycle updated: Day', cycleDay);
    }
}

async function showCurrentMood() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const moods = await convexClient.query('moods:getMoodLogs', { userId: currentUser._id });
        const todayMood = moods.find(m => m.date === today);
        
        // Update mood button display
        document.querySelectorAll('#dashboard .mood-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (todayMood && btn.dataset.mood === todayMood.mood.toString()) {
                btn.classList.add('selected');
            }
        });
        
        if (todayMood) {
            console.log('😊 Today\'s mood:', todayMood.mood);
        }
        
    } catch (error) {
        console.error('❌ Failed to load mood:', error);
    }
}

function showMainApp() {
    // Hide login page
    hideLoginPage();
    
    // Show main app
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('bottomNav').style.display = 'flex';
    
    // Update user interface
    const isAdmin = currentUser.role === 'admin';
    document.getElementById('userRole').textContent = `Logged in as: ${currentUser.name}`;
    document.getElementById('currentUser').textContent = `${currentUser.name} (${isAdmin ? 'Editor' : 'Viewer'})`;
    
    // Update auth button to show Logout
    document.getElementById('authBtn').textContent = 'Logout';
    
    if (!isAdmin) {
        document.getElementById('viewerNotice').style.display = 'block';
    }
    
    console.log('🏠 Main app displayed for', currentUser.name);
}

function hideLoginPage() {
    document.getElementById('loginPage').classList.remove('active');
}

function showLoginPage() {
    document.getElementById('loginPage').classList.add('active');
    // Reset auth button text
    document.getElementById('authBtn').textContent = 'Login';
    // Clear the input field
    document.getElementById('loginCode').value = '';
}

function logout() {
    console.log('👋 Logging out...');
    currentUser = null;
    localStorage.removeItem('camisflow-current-user');
    
    // Hide main app
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('viewerNotice').style.display = 'none';
    
    // Show login page
    showLoginPage();
    
    console.log('✅ Logged out successfully');
}

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Login button
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    
    // Logout button (the existing auth button becomes logout when logged in)
    document.getElementById('authBtn').addEventListener('click', () => {
        if (currentUser) {
            logout();
        }
    });
    
    // Period start button
    const periodBtn = document.getElementById('periodStartBtn');
    if (periodBtn) {
        periodBtn.addEventListener('click', handlePeriodStart);
    }
    
    // Mood buttons
    document.querySelectorAll('#dashboard .mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mood = parseInt(e.target.dataset.mood);
            handleMoodClick(mood);
        });
    });
    
    console.log('✅ All event listeners ready!');
}

console.log('📜 Convex app script loaded!'); 