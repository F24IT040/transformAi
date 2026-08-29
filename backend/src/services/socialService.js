/**
 * Social Media Publishing Service
 * Handles direct posting to LinkedIn API and Twitter/X API v2 with graceful fallback/simulation.
 */

async function publishToLinkedIn({ text, accessToken, authorId }) {
  if (accessToken && accessToken.trim()) {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: authorId || 'urn:li:person:me',
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(`LinkedIn API Error (${res.status}): ${responseText || res.statusText}`);
    }

    let parsed = {};
    try { parsed = JSON.parse(responseText); } catch (_) {}
    const postId = parsed.id || `urn:li:share:${Date.now()}`;
    return {
      success: true,
      platform: 'linkedin',
      postId,
      postUrl: `https://www.linkedin.com/feed/update/${postId}`,
      publishedAt: new Date().toISOString(),
      mode: 'live_api',
    };
  }

  // Simulated / Sandbox publication when API token is not configured
  const mockId = `urn:li:share:${Date.now()}`;
  return {
    success: true,
    platform: 'linkedin',
    postId: mockId,
    postUrl: `https://www.linkedin.com/feed/`,
    publishedAt: new Date().toISOString(),
    mode: 'simulated',
    message: 'Published in sandbox mode. Add LINKEDIN_ACCESS_TOKEN in backend/.env for live posting.',
  };
}

async function publishToTwitter({ text, bearerToken }) {
  if (bearerToken && bearerToken.trim()) {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(`Twitter/X API Error (${res.status}): ${responseText || res.statusText}`);
    }

    let parsed = {};
    try { parsed = JSON.parse(responseText); } catch (_) {}
    const tweetId = parsed.data?.id || `${Date.now()}`;
    return {
      success: true,
      platform: 'twitter',
      postId: tweetId,
      postUrl: `https://twitter.com/i/status/${tweetId}`,
      publishedAt: new Date().toISOString(),
      mode: 'live_api',
    };
  }

  // Simulated / Sandbox publication
  const mockId = `${Date.now()}`;
  return {
    success: true,
    platform: 'twitter',
    postId: mockId,
    postUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.substring(0, 280))}`,
    publishedAt: new Date().toISOString(),
    mode: 'simulated',
    message: 'Published in sandbox mode. Add TWITTER_BEARER_TOKEN in backend/.env for live API posting.',
  };
}

async function publishContent({ platform, text, token, authorId }) {
  if (!text || !text.trim()) {
    throw new Error('Content is required for social publishing.');
  }

  const cleanPlatform = (platform || '').toLowerCase();
  let formattedText = text.trim();

  // Prepend Official Government Emblem Header & hashtags if not already present
  if (!formattedText.includes('GOVERNMENT OF INDIA') && !formattedText.includes('🏛️')) {
    if (cleanPlatform === 'linkedin') {
      formattedText = `🏛️ GOVERNMENT OF INDIA | OFFICIAL ADVISORY\n\n${formattedText}\n\n#GovernmentOfIndia #OfficialAdvisory #India`;
    } else {
      const header = `🏛️ [GOI Official Advisory]\n\n`;
      const footer = `\n\n#India #Advisory`;
      const maxBodyLen = Math.max(50, 280 - header.length - footer.length);
      formattedText = `${header}${formattedText.substring(0, maxBodyLen)}${footer}`;
    }
  }

  if (cleanPlatform === 'linkedin') {
    const effectiveToken = token || process.env.LINKEDIN_ACCESS_TOKEN;
    return await publishToLinkedIn({ text: formattedText, accessToken: effectiveToken, authorId });
  } else if (cleanPlatform === 'twitter' || cleanPlatform === 'x') {
    const effectiveToken = token || process.env.TWITTER_BEARER_TOKEN;
    return await publishToTwitter({ text: formattedText, bearerToken: effectiveToken });
  } else {
    throw new Error(`Unsupported social platform '${platform}'. Choose 'linkedin' or 'twitter'.`);
  }
}

module.exports = { publishContent };
