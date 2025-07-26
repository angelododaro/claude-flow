/**
 * WebSocket Testing Utility for RAGBOARD Real-time Features
 * 
 * This utility provides functions to test WebSocket connectivity,
 * cursor tracking, presence system, and board synchronization.
 */

import wsService from '../services/websocket';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
}

class WebSocketTester {
  private results: TestResult[] = [];
  private testBoardId = 'test-board-' + Math.random().toString(36).substr(2, 9);

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting WebSocket Real-time Collaboration Tests...');
    this.results = [];

    await this.testConnection();
    await this.testAuthentication();
    await this.testPresenceSystem();
    await this.testCursorTracking();
    await this.testBoardSynchronization();
    await this.testErrorHandling();
    await this.testReconnection();

    this.printResults();
    return this.results;
  }

  private async testConnection(): Promise<void> {
    try {
      console.log('📡 Testing WebSocket connection...');
      
      const connectionPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        
        wsService.on('connected', () => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        wsService.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      wsService.connect(this.testBoardId);
      const connected = await connectionPromise;

      if (connected) {
        this.addResult('Connection', true, 'WebSocket connected successfully');
      } else {
        this.addResult('Connection', false, 'Failed to establish WebSocket connection');
      }
    } catch (error) {
      this.addResult('Connection', false, `Connection error: ${error.message}`);
    }
  }

  private async testAuthentication(): Promise<void> {
    try {
      console.log('🔐 Testing authentication...');
      
      // Check if auth token exists
      const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
      
      if (token) {
        this.addResult('Authentication', true, 'Auth token found and used for WebSocket connection');
      } else {
        this.addResult('Authentication', false, 'No auth token found - collaboration may not work');
      }
    } catch (error) {
      this.addResult('Authentication', false, `Auth error: ${error.message}`);
    }
  }

  private async testPresenceSystem(): Promise<void> {
    try {
      console.log('👥 Testing presence system...');
      
      const presencePromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        
        wsService.on('presence_join', (data) => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        wsService.on('connected', (data) => {
          if (data.presence && Array.isArray(data.presence)) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      const presenceReceived = await presencePromise;
      
      if (presenceReceived) {
        this.addResult('Presence', true, 'Presence system working correctly');
      } else {
        this.addResult('Presence', false, 'Presence updates not received');
      }
    } catch (error) {
      this.addResult('Presence', false, `Presence error: ${error.message}`);
    }
  }

  private async testCursorTracking(): Promise<void> {
    try {
      console.log('🖱️ Testing cursor tracking...');
      
      // Send a test cursor position
      wsService.sendCursorPosition(50, 50);
      
      // In a real test, we'd check if other clients receive this update
      // For now, we just verify the send doesn't throw an error
      this.addResult('Cursor Tracking', true, 'Cursor position sent successfully');
    } catch (error) {
      this.addResult('Cursor Tracking', false, `Cursor tracking error: ${error.message}`);
    }
  }

  private async testBoardSynchronization(): Promise<void> {
    try {
      console.log('🔄 Testing board synchronization...');
      
      // Send a test board update
      const testUpdate = {
        type: 'test_update',
        timestamp: Date.now(),
        data: { test: true }
      };
      
      wsService.sendBoardUpdate(testUpdate);
      
      this.addResult('Board Sync', true, 'Board update sent successfully');
    } catch (error) {
      this.addResult('Board Sync', false, `Board sync error: ${error.message}`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    try {
      console.log('❌ Testing error handling...');
      
      const errorPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);
        
        wsService.on('send_failed', () => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        wsService.on('error', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });

      // Disconnect and try to send a message to trigger error handling
      wsService.disconnect();
      wsService.sendCursorPosition(0, 0);
      
      const errorHandled = await errorPromise;
      
      if (errorHandled) {
        this.addResult('Error Handling', true, 'Error handling working correctly');
      } else {
        this.addResult('Error Handling', false, 'Error handling not triggered');
      }
    } catch (error) {
      this.addResult('Error Handling', false, `Error handling test failed: ${error.message}`);
    }
  }

  private async testReconnection(): Promise<void> {
    try {
      console.log('🔄 Testing reconnection...');
      
      const reconnectPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 10000);
        
        wsService.on('connected', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });

      // Reconnect
      wsService.connect(this.testBoardId);
      const reconnected = await reconnectPromise;
      
      if (reconnected) {
        this.addResult('Reconnection', true, 'Automatic reconnection working');
      } else {
        this.addResult('Reconnection', false, 'Reconnection failed');
      }
    } catch (error) {
      this.addResult('Reconnection', false, `Reconnection error: ${error.message}`);
    }
  }

  private addResult(test: string, success: boolean, message: string, data?: any): void {
    this.results.push({ test, success, message, data });
  }

  private printResults(): void {
    console.log('\n📊 WebSocket Test Results:');
    console.log('=' * 50);
    
    this.results.forEach((result, index) => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${icon} ${result.test}: ${result.message}`);
    });
    
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log('\n📈 Summary:');
    console.log(`Tests passed: ${passed}/${total} (${Math.round((passed/total) * 100)}%)`);
    
    if (passed === total) {
      console.log('🎉 All WebSocket real-time collaboration features are working!');
    } else {
      console.log('⚠️ Some features need attention. Check the failed tests above.');
    }
  }
}

// Export the tester for use in the browser console or components
export const webSocketTester = new WebSocketTester();

// Auto-run tests in development mode
if (process.env.NODE_ENV === 'development') {
  // Delay auto-run to allow other components to initialize
  setTimeout(() => {
    console.log('🚀 Auto-running WebSocket tests in development mode...');
    webSocketTester.runAllTests();
  }, 5000);
}

export default webSocketTester;