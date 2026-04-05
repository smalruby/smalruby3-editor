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
     * Delete a classroom (soft-delete).
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID to delete
     * @returns {Promise<void>}
     */
    async deleteClassroom(idToken, classroomId) {
        return this._request('DELETE', `/classrooms/${classroomId}`, null, idToken);
    }

    /**
     * Look up a classroom by join code (validates code, returns seat info).
     * @param {string} joinCode - 6-digit join code
     * @returns {Promise<object>} Classroom info with takenSeats
     */
    async lookupClassroom(joinCode) {
        return this._request('POST', '/classrooms/lookup', { joinCode });
    }

    /**
     * Verify that a student session token is still valid.
     * @param {string} sessionToken - Student session token
     * @returns {Promise<object>} Verification result
     */
    async verifySession(sessionToken) {
        return this._request('POST', '/classrooms/verify-session', null, sessionToken);
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
     * Leave a classroom (student self-removal).
     * @param {string} sessionToken - Student session token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<void>}
     */
    async leaveClassroom(sessionToken, classroomId) {
        return this._request('DELETE', `/classrooms/${classroomId}/members/me`, null, sessionToken);
    }

    /**
     * Create a submission (get presigned URLs for upload).
     * @param {string} sessionToken - Student session token
     * @param {string} classroomId - Classroom ID
     * @param {string} projectName - Project name
     * @param {number} [screenshotCount] - Number of block screenshots
     * @returns {Promise<object>} Submission data with upload URLs
     */
    async createSubmission(sessionToken, classroomId, projectName, screenshotCount = 0) {
        return this._request(
            'POST',
            `/classrooms/${classroomId}/submissions`,
            { projectName, screenshotCount },
            sessionToken,
        );
    }

    /**
     * List submissions for a classroom (teacher only).
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<object>} Submissions list
     */
    async listSubmissions(idToken, classroomId) {
        return this._request('GET', `/classrooms/${classroomId}/submissions`, null, idToken);
    }

    /**
     * Update a submission (teacher comment / return).
     * @param {string} idToken - Google ID token
     * @param {string} classroomId - Classroom ID
     * @param {string} submissionId - Submission ID
     * @param {object} updates - Fields to update (teacherComment, status)
     * @returns {Promise<object>} Updated submission data
     */
    async updateSubmission(idToken, classroomId, submissionId, updates) {
        return this._request('PATCH', `/classrooms/${classroomId}/submissions/${submissionId}`, updates, idToken);
    }

    /**
     * Upload data to a presigned URL.
     * @param {string} url - Presigned URL
     * @param {ArrayBuffer|Blob|string} data - Data to upload
     * @param {string} contentType - MIME type
     * @returns {Promise<void>}
     */
    async uploadToPresignedUrl(url, data, contentType) {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: data,
        });
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
    }

    // --- Google Classroom integration ---

    /**
     * List Google Classroom courses for the teacher.
     * @param {string} idToken - Google ID token
     * @param {string} googleAccessToken - Google access token with Classroom scopes
     * @returns {Promise<object>} List of courses
     */
    async listGoogleCourses(idToken, googleAccessToken) {
        return this._request('GET', '/classrooms/google-courses', null, idToken, googleAccessToken);
    }

    /**
     * Import a Google Classroom course as a Smalruby classroom.
     * @param {string} idToken - Google ID token
     * @param {string} googleAccessToken - Google access token with Classroom scopes
     * @param {string} courseId - Google Classroom course ID
     * @returns {Promise<object>} Created classroom data
     */
    async importGoogleClassroom(idToken, googleAccessToken, courseId) {
        return this._request('POST', '/classrooms/google-import', { courseId }, idToken, googleAccessToken);
    }

    /**
     * Post an assignment link to Google Classroom.
     * @param {string} idToken - Google ID token
     * @param {string} googleAccessToken - Google access token with Classroom scopes
     * @param {string} classroomId - Smalruby classroom ID
     * @param {string} title - Assignment title
     * @param {string} link - Assignment URL
     * @param {string} [description] - Assignment description
     * @returns {Promise<object>} Created courseWork data
     */
    async postGoogleAssignment(idToken, googleAccessToken, classroomId, title, link, description) {
        return this._request(
            'POST',
            `/classrooms/${classroomId}/google-assignment`,
            { title, link, description },
            idToken,
            googleAccessToken,
        );
    }

    /**
     * Internal request helper.
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @param {object|null} body - Request body
     * @param {string} [authToken] - Bearer token
     * @param {string} [googleAccessToken] - Google access token for Classroom API proxy
     * @returns {Promise<object|void>} Response data
     * @private
     */
    async _request(method, path, body, authToken, googleAccessToken) {
        const url = `${CLASSROOM_API_ENDPOINT}${path}`;
        const headers = {
            'Content-Type': 'application/json',
        };
        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }
        if (googleAccessToken) {
            headers['X-Google-Access-Token'] = googleAccessToken;
        }

        const options = { method, headers };
        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        const maxRetries = 3;
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(url, options);

            if (response.status === 204) return null;

            if (response.status === 429 && attempt < maxRetries) {
                // Exponential backoff: 500ms, 1000ms, 2000ms + jitter
                const delay = 500 * Math.pow(2, attempt);
                const jitter = Math.random() * 200;
                await new Promise(r => setTimeout(r, delay + jitter));
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                lastError = new Error(errorData.error || `API error ${response.status}`);
                lastError.status = response.status;
                throw lastError;
            }

            return response.json();
        }

        throw lastError;
    }
}

const isClassroomConfigured = ClassroomAPI.isConfigured;

export { isClassroomConfigured };
export default new ClassroomAPI();
