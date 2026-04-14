/**
 * Client Instance Tracker
 * 
 * Tracks how many Supabase client instances are created
 * Multiple instances = multiple token refresh attempts = 429 errors
 */

let clientInstanceCount = 0;
const clientCreationStack: Array<{ count: number; timestamp: number; stack?: string; clientId?: string }> = [];
const createdClients = new WeakSet();

export function trackClientCreation(client?: any) {
  clientInstanceCount++;
  const stack = new Error().stack;
  
  // Extract meaningful stack info (skip Error constructor and trackClientCreation itself)
  const stackLines = stack?.split('\n') || [];
  const relevantStack = stackLines
    .slice(3, 8) // Skip Error, trackClientCreation, createClient
    .filter(line => !line.includes('client-instance-tracker'))
    .join('\n');
  
  // Generate a unique ID for this client instance
  const clientId = client ? `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined;
  
  // Track if we've seen this client before (WeakSet for object identity)
  let isNewClient = true;
  if (client) {
    if (createdClients.has(client)) {
      isNewClient = false;
      console.warn('⚠️ Same client object being tracked multiple times - this is a bug in tracking, not actual multiple instances');
    } else {
      createdClients.add(client);
    }
  }
  
  clientCreationStack.push({
    count: clientInstanceCount,
    timestamp: Date.now(),
    stack: relevantStack,
    clientId,
  });

  // Keep only last 20 creations
  if (clientCreationStack.length > 20) {
    clientCreationStack.shift();
  }

  // Only warn if we're creating multiple instances (should be 1 with singleton)
  if (clientInstanceCount > 1 && isNewClient) {
    console.warn(
      `⚠️ Multiple Supabase client instances created! (${clientInstanceCount} total)`,
      '\nThis indicates the singleton pattern is not working correctly.',
      '\nPossible causes:',
      '\n  - Next.js code splitting creating separate module scopes',
      '\n  - Hot module reloading resetting the singleton',
      '\n  - Multiple bundles/chunks each with their own module scope',
      '\nEach instance can independently refresh tokens, causing 429 errors.',
      '\nCheck the stack trace below to see where instances are being created.'
    );
    
    // Show the call site that created this instance
    const callSite = stackLines.find(line => 
      line.includes('createClient') && !line.includes('client.ts')
    ) || stackLines[3] || 'unknown';
    
    console.warn('Call site:', callSite.trim());
    
    // Show if this is likely a hot reload issue
    const timeSinceFirst = clientCreationStack.length > 1 
      ? Date.now() - (clientCreationStack[0]?.timestamp || 0)
      : 0;
    if (timeSinceFirst < 5000) {
      console.warn('⚠️ Multiple instances created within 5 seconds - likely hot reload or code splitting issue');
    }
    
    console.trace('Full creation stack:', stack);
  } else if (clientInstanceCount === 1) {
    // Log first creation for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Supabase client singleton created (1 instance)');
    }
  }
}

export function getClientInstanceCount(): number {
  return clientInstanceCount;
}

export function getClientCreationHistory(): Array<{ count: number; timestamp: number; stack?: string }> {
  return [...clientCreationStack];
}

export function resetClientTracking() {
  clientInstanceCount = 0;
  clientCreationStack.length = 0;
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__clientTracker = {
    getCount: getClientInstanceCount,
    getHistory: getClientCreationHistory,
    reset: resetClientTracking,
  };
}

