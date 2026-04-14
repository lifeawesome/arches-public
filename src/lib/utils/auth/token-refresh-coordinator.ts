/**
 * Cross-tab token refresh coordinator
 * 
 * Prevents multiple browser tabs from simultaneously refreshing tokens,
 * which was causing rate limit issues. Only one tab performs the refresh
 * and broadcasts the result to other tabs.
 */

const CHANNEL_NAME = 'arches-auth-refresh';
const REFRESH_LOCK_TIMEOUT = 5000; // 5 seconds - if a tab doesn't respond, another can take over

interface RefreshMessage {
  type: 'REQUEST_REFRESH' | 'REFRESH_IN_PROGRESS' | 'REFRESH_COMPLETE' | 'REFRESH_FAILED';
  tabId: string;
  timestamp: number;
  error?: string;
}

class TokenRefreshCoordinator {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;
  private listeners: Set<(isRefreshing: boolean) => void> = new Set();

  constructor() {
    this.tabId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.setupChannelListener();
    }
  }

  private setupChannelListener() {
    if (!this.channel) return;

    this.channel.onmessage = (event: MessageEvent<RefreshMessage>) => {
      const message = event.data;

      // Ignore messages from this tab
      if (message.tabId === this.tabId) return;

      switch (message.type) {
        case 'REFRESH_IN_PROGRESS':
          // Another tab is refreshing, mark as refreshing
          this.isRefreshing = true;
          this.notifyListeners(true);
          break;

        case 'REFRESH_COMPLETE':
          // Another tab completed refresh, we can clear our state
          this.isRefreshing = false;
          this.refreshPromise = null;
          this.notifyListeners(false);
          break;

        case 'REFRESH_FAILED':
          // Another tab failed, we can try if needed
          this.isRefreshing = false;
          this.refreshPromise = null;
          this.notifyListeners(false);
          break;

        case 'REQUEST_REFRESH':
          // Another tab is requesting refresh - if we're not already refreshing,
          // we could respond, but for simplicity, we'll let the requester handle it
          break;
      }
    };
  }

  /**
   * Request permission to refresh token
   * Returns true if this tab should perform the refresh
   */
  async requestRefresh(): Promise<boolean> {
    // If already refreshing in this tab, return false
    if (this.isRefreshing) {
      return false;
    }

    // If no BroadcastChannel support, this tab can refresh
    if (!this.channel) {
      return true;
    }

    // Check if another tab is already refreshing
    const message: RefreshMessage = {
      type: 'REQUEST_REFRESH',
      tabId: this.tabId,
      timestamp: Date.now(),
    };
    this.channel.postMessage(message);

    // Wait a short time to see if another tab responds
    await new Promise((resolve) => setTimeout(resolve, 100));

    // If no other tab claimed it, we can proceed
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.broadcast('REFRESH_IN_PROGRESS');
      this.notifyListeners(true);
      return true;
    }

    return false;
  }

  /**
   * Mark refresh as complete
   */
  completeRefresh() {
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.broadcast('REFRESH_COMPLETE');
    this.notifyListeners(false);
  }

  /**
   * Mark refresh as failed
   */
  failRefresh(error?: string) {
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.broadcast('REFRESH_FAILED', error);
    this.notifyListeners(false);
  }

  /**
   * Check if any tab is currently refreshing
   */
  isAnyTabRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Subscribe to refresh state changes
   */
  onRefreshStateChange(callback: (isRefreshing: boolean) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private broadcast(type: RefreshMessage['type'], error?: string) {
    if (!this.channel) return;

    const message: RefreshMessage = {
      type,
      tabId: this.tabId,
      timestamp: Date.now(),
      error,
    };
    this.channel.postMessage(message);
  }

  private notifyListeners(isRefreshing: boolean) {
    this.listeners.forEach((callback) => {
      try {
        callback(isRefreshing);
      } catch (error) {
        console.error('[TokenRefreshCoordinator] Listener error:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
let coordinatorInstance: TokenRefreshCoordinator | null = null;

export function getTokenRefreshCoordinator(): TokenRefreshCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new TokenRefreshCoordinator();
  }
  return coordinatorInstance;
}

