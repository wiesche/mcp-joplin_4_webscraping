import axios from 'axios';

class ClipUrlTool {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async call(url, notebook_id, tags, title) {
    try {
      // 1. Fetch the HTML content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const html = response.data;

      // 2. Extract title if not provided
      let noteTitle = title;
      if (!noteTitle) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        noteTitle = titleMatch ? titleMatch[1].trim() : 'Clipped Note';
      }

      // 3. Send to Joplin
      const result = await this.apiClient.clipPage(
        url,
        html,
        noteTitle,
        notebook_id,
        tags
      );

      return `Successfully clipped "${noteTitle}" to Joplin!\nNote ID: ${result.id}\nView Note: [Open in Joplin](joplin://x-callback-url/openNote?id=${result.id})`;
    } catch (error) {
      if (error.message && error.message.includes('Joplin API token is missing')) {
        throw error; // Re-throw auth errors as-is
      }
      throw new Error(`Failed to clip URL: ${error.message}`);
    }
  }
}

export { ClipUrlTool };
