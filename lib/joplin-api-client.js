import axios from 'axios';

class JoplinAPIClient {
  constructor({ port = 41184, authManager }) {
    this.baseURL = `http://127.0.0.1:${port}`;
    this.authManager = authManager;
  }

  get token() {
    return this.authManager ? this.authManager.getToken() : null;
  }

  handleAuthError(error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Start the auth server if not already running
      if (this.authManager) {
        this.authManager.ensureStarted();
      }
      const authUrl = this.authManager ? this.authManager.getAuthUrl() : 'unknown';
      throw new Error(`Joplin API token is missing or invalid. Please configure it by visiting: ${authUrl}`);
    }
    throw error;
  }

  async serviceAvailable() {
    try {
      const response = await axios.get(`${this.baseURL}/ping`);
      return response.status === 200 && response.data === 'JoplinClipperServer';
    } catch (error) {
      console.error('Error checking Joplin service availability:', error);
      return false;
    }
  }

  async getAllItems(path, options = {}) {
    let page = 1;
    const items = [];

    try {
      while (true) {
        const response = await this.get(path, this.mergeRequestOptions(options, { query: { page } }));

        // Validate response format
        if (!response || typeof response !== 'object' || !Array.isArray(response.items)) {
          throw new Error(`Unexpected response format from Joplin API for path: ${path}`);
        }

        items.push(...response.items);
        page += 1;

        if (!response.has_more) break;
      }

      return items;
    } catch (error) {
      console.error(`Error in getAllItems for path ${path}:`, error);
      throw error;
    }
  }

  async get(path, options = {}) {
    try {
      const { data } = await axios.get(
        `${this.baseURL}${path}`,
        {
          params: this.requestOptions(options).query
        }
      );
      return data;
    } catch (error) {
      // Don't log auth errors to console, they are handled gracefully
      if (!error.response || (error.response.status !== 401 && error.response.status !== 403)) {
        console.error(`Error in GET request for path ${path}:`, error);
      }
      this.handleAuthError(error);
    }
  }

  async post(path, body, options = {}) {
    try {
      const { data } = await axios.post(
        `${this.baseURL}${path}`,
        body,
        {
          params: this.requestOptions(options).query
        }
      );
      return data;
    } catch (error) {
      if (!error.response || (error.response.status !== 401 && error.response.status !== 403)) {
        console.error(`Error in POST request for path ${path}:`, error);
      }
      this.handleAuthError(error);
    }
  }

  async delete(path, options = {}) {
    try {
      const { data } = await axios.delete(
        `${this.baseURL}${path}`,
        {
          params: this.requestOptions(options).query
        }
      );
      return data;
    } catch (error) {
      if (!error.response || (error.response.status !== 401 && error.response.status !== 403)) {
        console.error(`Error in DELETE request for path ${path}:`, error);
      }
      this.handleAuthError(error);
    }
  }

  async put(path, body, options = {}) {
    try {
      const { data } = await axios.put(
        `${this.baseURL}${path}`,
        body,
        {
          params: this.requestOptions(options).query
        }
      );
      return data;
    } catch (error) {
      if (!error.response || (error.response.status !== 401 && error.response.status !== 403)) {
        console.error(`Error in PUT request for path ${path}:`, error);
      }
      this.handleAuthError(error);
    }
  }

  async clipPage(url, html, title, parentId, tags) {
    // Mimic Joplin Web Clipper behavior
    const body = {
      title: title || 'New Note',
      body_html: html,
      source_url: url,
      convert_to: 'markdown'
    };

    if (parentId) body.parent_id = parentId;
    if (tags) body.tags = tags;

    return this.post('/notes', body);
  }

  requestOptions(options = {}) {
    return this.mergeRequestOptions(
      {
        query: { token: this.token }
      },
      options
    );
  }

  mergeRequestOptions(options1, options2) {
    return {
      query: {
        ...(options1.query || {}),
        ...(options2.query || {})
      },
      ...this.except(options1, 'query'),
      ...this.except(options2, 'query')
    };
  }

  except(obj, key) {
    const result = { ...obj };
    delete result[key];
    return result;
  }
}

export default JoplinAPIClient;
