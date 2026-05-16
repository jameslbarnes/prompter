// Interview purchase functionality
// Use window function since utils.js is not a module anymore
const showError = window.showError;

let purchaseModal = null;

export async function showInterviewPurchaseModal() {
    // Get current balance and pricing
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        showError('Please sign in to purchase interviews');
        return;
    }
    
    const token = await currentUser.getIdToken();

    try {
        const response = await fetch('/api/pricing/interviews', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load pricing information');
        }

        const { bundles, userBalance } = await response.json();
        
        // Create modal if it doesn't exist
        if (!purchaseModal) {
            createPurchaseModal();
        }

        // Update modal content with pricing and balance
        updateModalContent(bundles, userBalance);
        
        // Show modal
        purchaseModal.classList.add('show');
    } catch (error) {
        console.error('Error loading interview pricing:', error);
        showError('Failed to load pricing information. Please try again.');
    }
}

function createPurchaseModal() {
    const modalHTML = `
        <div id="interviewPurchaseModal" class="modal-overlay">
            <div class="modal-content interview-purchase-modal">
                <button class="modal-close" onclick="closeInterviewPurchaseModal()">×</button>
                <h2>Purchase Additional Interviews</h2>
                
                <div class="current-balance">
                    <h3>Your Current Balance</h3>
                    <div class="balance-details">
                        <div class="balance-item">
                            <span class="balance-label">Plan interviews remaining:</span>
                            <span id="planInterviewsRemaining" class="balance-value">-</span>
                        </div>
                        <div class="balance-item">
                            <span class="balance-label">Purchased interviews remaining:</span>
                            <span id="purchasedInterviewsRemaining" class="balance-value">-</span>
                        </div>
                        <div class="balance-item total">
                            <span class="balance-label">Total available:</span>
                            <span id="totalInterviewsRemaining" class="balance-value">-</span>
                        </div>
                    </div>
                </div>

                <div class="interview-bundles">
                    <h3>Choose a Bundle</h3>
                    <div id="bundleOptions" class="bundle-grid">
                        <!-- Bundle options will be inserted here -->
                    </div>
                </div>

                <div class="purchase-notes">
                    <p class="note">• Purchased interviews never expire</p>
                    <p class="note">• Secure payment processed by Stripe</p>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    purchaseModal = document.getElementById('interviewPurchaseModal');
    
    // Close modal when clicking outside
    purchaseModal.addEventListener('click', (e) => {
        if (e.target === purchaseModal) {
            closeInterviewPurchaseModal();
        }
    });
}

function updateModalContent(bundles, userBalance) {
    // Update balance display
    document.getElementById('planInterviewsRemaining').textContent = userBalance.planInterviewsRemaining;
    document.getElementById('purchasedInterviewsRemaining').textContent = userBalance.purchasedInterviewsRemaining;
    document.getElementById('totalInterviewsRemaining').textContent = userBalance.totalRemaining;

    // Update bundle options
    const bundleContainer = document.getElementById('bundleOptions');
    bundleContainer.innerHTML = '';

    // Sort bundles by quantity
    const sortedBundles = Object.entries(bundles).sort((a, b) => a[1].quantity - b[1].quantity);

    sortedBundles.forEach(([bundleType, bundle]) => {
        const bundleElement = createBundleOption(bundleType, bundle);
        bundleContainer.appendChild(bundleElement);
    });
}

function createBundleOption(bundleType, bundle) {
    const div = document.createElement('div');
    div.className = 'bundle-option';
    
    const savings = bundle.quantity > 1 ? 
        Math.round((1 - bundle.unitPrice) * 100) : 0;
    
    div.innerHTML = `
        <div class="bundle-header">
            <h4>${bundle.name}</h4>
            ${savings > 0 ? `<span class="savings-badge">Save ${savings}%</span>` : ''}
        </div>
        <div class="bundle-price">$${bundle.price}</div>
        <div class="bundle-details">
            <span class="interviews-count">${bundle.quantity} interview${bundle.quantity > 1 ? 's' : ''}</span>
            <span class="price-per">$${bundle.unitPrice.toFixed(2)} each</span>
        </div>
        <button class="purchase-bundle-btn" onclick="purchaseBundle('${bundleType}')">
            Purchase
        </button>
    `;
    
    return div;
}

window.purchaseBundle = async function(bundleType) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        showError('Please sign in to purchase interviews');
        return;
    }
    
    const token = await currentUser.getIdToken();

    try {
        // Disable all purchase buttons
        const buttons = document.querySelectorAll('.purchase-bundle-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        const response = await fetch('/api/purchase/interviews', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bundleType })
        });

        if (!response.ok) {
            throw new Error('Failed to create purchase session');
        }

        const { checkoutUrl } = await response.json();
        
        // Redirect to Stripe checkout
        window.location.href = checkoutUrl;
    } catch (error) {
        console.error('Error creating purchase session:', error);
        showError('Failed to start purchase. Please try again.');
        
        // Re-enable buttons
        const buttons = document.querySelectorAll('.purchase-bundle-btn');
        buttons.forEach(btn => btn.disabled = false);
    }
};

window.closeInterviewPurchaseModal = function() {
    if (purchaseModal) {
        purchaseModal.classList.remove('show');
    }
};

// Make showInterviewPurchaseModal available globally
window.showInterviewPurchaseModal = showInterviewPurchaseModal;

// Update interview balance display
export async function updateInterviewBalance() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    const token = await currentUser.getIdToken();

    try {
        const response = await fetch('/api/pricing/interviews', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) return;

        const { userBalance } = await response.json();
        
        // Update balance displays in UI
        const planDisplay = document.getElementById('planInterviews');
        const purchasedDisplay = document.getElementById('purchasedInterviews');
        
        if (planDisplay) planDisplay.textContent = userBalance.planInterviewsRemaining;
        if (purchasedDisplay) purchasedDisplay.textContent = userBalance.purchasedInterviewsRemaining;
        
        // Show/hide buy more button based on balance
        const buyMoreBtn = document.getElementById('buyMoreBtn');
        if (buyMoreBtn) {
            buyMoreBtn.style.display = userBalance.totalRemaining < 5 ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Error updating interview balance:', error);
    }
}