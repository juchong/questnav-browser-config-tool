/**
 * Webhook Routes
 * Handles incoming webhooks from external services (GitHub)
 */

import express from 'express';
import { verifyGitHubSignature, processReleaseWebhook, GitHubReleaseWebhook } from '../services/webhookService';
import { ApiResponse } from '../models/types';

const router = express.Router();

// GitHub webhook handler
router.post('/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('GITHUB_WEBHOOK_SECRET not configured in production!');
        const response: ApiResponse = {
          success: false,
          error: 'Webhook authentication not configured'
        };
        return res.status(500).json(response);
      }
      console.warn('GITHUB_WEBHOOK_SECRET not configured - webhook signature not verified!');
    } else {
      if (!verifyGitHubSignature(payload, signature, webhookSecret)) {
        console.warn('Invalid GitHub webhook signature');
        const response: ApiResponse = {
          success: false,
          error: 'Invalid signature'
        };
        return res.status(401).json(response);
      }
    }

    // Only process release events
    if (event !== 'release') {
      const response: ApiResponse = {
        success: true,
        data: { message: `Ignored event type: ${event}` }
      };
      return res.json(response);
    }

    // Process release webhook
    const webhook = req.body as GitHubReleaseWebhook;
    const result = await processReleaseWebhook(webhook);

    if (result.success) {
      const response: ApiResponse = {
        success: true,
        data: {
          message: result.message,
          releaseId: result.releaseId
        }
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: result.message
      };
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('Error handling GitHub webhook:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Health check for webhook endpoint and configuration status
router.get('/github', (req, res) => {
  const secretConfigured = !!process.env.GITHUB_WEBHOOK_SECRET;
  const response: ApiResponse = {
    success: true,
    data: {
      message: 'GitHub webhook endpoint is ready',
      secretConfigured
    }
  };
  res.json(response);
});

// Test webhook endpoint (development only)
router.post('/github/test', async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      const response: ApiResponse = {
        success: false,
        error: 'Test endpoint not available in production'
      };
      return res.status(403).json(response);
    }

    const { tag_name, apk_url, apk_name } = req.body;

    // Validation
    if (!tag_name || !apk_url || !apk_name) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: tag_name, apk_url, apk_name'
      };
      return res.status(400).json(response);
    }

    // Create a mock GitHub webhook payload
    const mockWebhook: GitHubReleaseWebhook = {
      action: 'published',
      release: {
        tag_name,
        name: tag_name,
        published_at: new Date().toISOString(),
        html_url: `https://github.com/${process.env.QUESTNAV_REPO || 'QuestNav/QuestNav'}/releases/tag/${tag_name}`,
        assets: [
          {
            name: apk_name,
            browser_download_url: apk_url,
            size: 0
          }
        ]
      },
      repository: {
        full_name: process.env.QUESTNAV_REPO || 'QuestNav/QuestNav'
      }
    };

    // Process the mock webhook
    const result = await processReleaseWebhook(mockWebhook);

    if (result.success) {
      const response: ApiResponse = {
        success: true,
        data: {
          message: result.message,
          releaseId: result.releaseId,
          note: 'This was a test webhook - signature verification was skipped'
        }
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: result.message
      };
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('Error handling test webhook:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

export default router;

