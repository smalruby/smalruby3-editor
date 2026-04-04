/**
 * Classroom API Client
 *
 * Communicates with smalruby-classroom (AWS Lambda) for
 * class management and student participation.
 */

const CLASSROOM_API_ENDPOINT = process.env.CLASSROOM_API_ENDPOINT || '';

class ClassroomAPI {
    /**
     * Check if the classroom API is configured.
     * @returns {boolean} True if the endpoint is set
     */
    static isConfigured() {
        return !!CLASSROOM_API_ENDPOINT;
    }

    /**
     * Create a new classroom.
     * @param {string} idToken - Google ID token for teacher authentication
     * @param {string} className - Name of the class
     * @param {number} studentCount - Number of students
     * @returns {Promise<object>} Created classroom data
     */
    async createClassroom(idToken, className, studentCount) {
        return this._request('POST', '/classrooms', { className, studentCount }, idToken);
    }

    /**
     * List classrooms for the authenticated teacher.
     * @param {string} idToken - Google ID token
     * @returns {Promise<object>} List of classrooms
     */
    async listClassrooms(idToken) {
        return this._request('GET', '/classrooms', null, idToken);
    }

    /**
     * Get classroom details.
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<object>} Classroom data
     */
    async getClassroom(idToken, classroomId) {
        return this._request('GET', `/classrooms/${classroomId}`, null, idToken);
    }

    /**
     * Update a classroom.
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>} Updated classroom data
     */
    async updateClassroom(idToken, classroomId, updates) {
        return this._request('PATCH', `/classrooms/${classroomId}`, updates, idToken);
    }

    /**
     * Join a classroom as a student.
     * @param {string} joinCode - 6-digit join code
     * @param {number} seatNumber - Selected seat number
     * @param {string} [nickname] - Optional nickname
     * @returns {Promise<object>} Session data including sessionToken
     */
    async joinClassroom(joinCode, seatNumber, nickname) {
        return this._request('POST', '/classrooms/join', {
            joinCode,
            seatNumber,
            ...(nickname ? { nickname } : {}),
        });
    }

    /**
     * List members of a classroom.
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<object>} Members list
     */
    async listMembers(idToken, classroomId) {
        return this._request('GET', `/classrooms/${classroomId}/members`, null, idToken);
    }

    /**
     * Delete a member from a classroom.
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID
     * @param {string} memberId - Member ID to delete
     * @returns {Promise<void>}
     */
    async deleteMember(idToken, classroomId, memberId) {
        return this._request('DELETE', `/classrooms/${classroomId}/members/${memberId}`, null, idToken);
    }

    /**
     * Internal request helper.
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @param {object|null} body - Request body
     * @param {string} [authToken] - Bearer token
     * @returns {Promise<object|void>} Response data
     * @private
     */
    async _request(method, path, body, authToken) {
        const url = `${CLASSROOM_API_ENDPOINT}${path}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const options = { method, headers };
        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (response.status === 204) return null;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.error || `API error ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return response.json();
    }
}

const isClassroomConfigured = ClassroomAPI.isConfigured;

export { isClassroomConfigured };
export default new ClassroomAPI();
