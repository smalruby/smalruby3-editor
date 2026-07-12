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
     * @param {string} assignmentName - Name of the assignment
     * @param {number} studentCount - Number of students
     * @param {string} [googleClassroomCourseId] - Google Classroom course ID (for imported classes)
     * @param {string} [groupId] - Owning class (group) — inherits studentCount when omitted
     * @returns {Promise<object>} Created classroom data
     */
    async createClassroom(idToken, className, assignmentName, studentCount, googleClassroomCourseId, groupId) {
        const body = { className, assignmentName };
        // v2: omit studentCount to inherit it from the owning class (group)
        if (typeof studentCount === 'number') {
            body.studentCount = studentCount;
        }
        if (googleClassroomCourseId) {
            body.googleClassroomCourseId = googleClassroomCourseId;
        }
        if (groupId) {
            body.groupId = groupId;
        }
        return this._request('POST', '/classrooms', body, idToken);
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
     * List co-teachers (shared managers) of a classroom (owner or co-teacher).
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<object>} {ownerSub, coTeacherEmails: string[]}
     */
    async listCoTeachers(idToken, classroomId) {
        return this._request('GET', `/classrooms/${classroomId}/co-teachers`, null, idToken);
    }

    /**
     * Invite a co-teacher by email (owner or co-teacher). Idempotent.
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @param {string} email - Email address to invite
     * @returns {Promise<object>} {coTeacherEmails: string[]}
     */
    async addCoTeacher(idToken, classroomId, email) {
        return this._request('POST', `/classrooms/${classroomId}/co-teachers`, { email }, idToken);
    }

    /**
     * Remove a co-teacher by email (owner or co-teacher).
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @param {string} email - Email address to remove
     * @returns {Promise<object>} {coTeacherEmails: string[]}
     */
    async removeCoTeacher(idToken, classroomId, email) {
        return this._request(
            'DELETE',
            `/classrooms/${classroomId}/co-teachers/${encodeURIComponent(email)}`,
            null,
            idToken,
        );
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
     * Ask the teacher to free up a specific seat (kick request). Anonymous —
     * the request only carries joinCode + seatNumber + optional reason. Used
     * by students who want a seat that is currently occupied by someone who
     * (likely) picked the wrong seat number.
     * @param {string} joinCode - 6-digit join code
     * @param {number} seatNumber - Seat the student wants freed
     * @param {string} [reason] - Optional short message to the teacher
     * @returns {Promise<object>} {requestId, classroomId, seatNumber}
     */
    async createKickRequest(joinCode, seatNumber, reason) {
        const body = { joinCode, seatNumber };
        if (reason) body.reason = reason;
        return this._request('POST', '/classrooms/lookup/kick-request', body);
    }

    /**
     * List pending kick requests for a classroom (teacher only).
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<object>} {requests: [{requestId, seatNumber, reason, createdAt}]}
     */
    async listKickRequests(idToken, classroomId) {
        return this._request('GET', `/classrooms/${classroomId}/kick-requests`, null, idToken);
    }

    /**
     * Approve a kick request: removes the seat occupant and clears all
     * sibling requests for that seat (teacher only).
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @param {string} requestId - Kick request ID
     * @returns {Promise<null>} Resolves to null on success (HTTP 204).
     */
    async approveKickRequest(idToken, classroomId, requestId) {
        return this._request('POST', `/classrooms/${classroomId}/kick-requests/${requestId}/approve`, null, idToken);
    }

    /**
     * Reject a kick request: deletes the request but leaves the occupant in
     * place (teacher only).
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @param {string} requestId - Kick request ID
     * @returns {Promise<null>} Resolves to null on success (HTTP 204).
     */
    async rejectKickRequest(idToken, classroomId, requestId) {
        return this._request('DELETE', `/classrooms/${classroomId}/kick-requests/${requestId}`, null, idToken);
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

    // --- Groups (組) ---

    /**
     * Create a group (組) — the teacher-side organizing concept.
     * @param {string} idToken - Teacher ID token
     * @param {string} name - Group name (e.g. 2年1組)
     * @param {number} year - School year
     * @param {object} [options] - Additional class fields (studentCount, googleClassroomCourseId)
     * @returns {Promise<object>} Created group
     */
    async createGroup(idToken, name, year, options = {}) {
        return this._request('POST', '/classroom-groups', { name, year, ...options }, idToken);
    }

    /**
     * Run the idempotent v1→v2 migration for this teacher: adopt ungrouped
     * assignments into auto-created classes and lift class-level fields.
     * Called from the class list on login; a migrated account is a no-op.
     * @param {string} idToken - Teacher ID token
     * @returns {Promise<object>} Migration summary
     */
    async migrateGroups(idToken) {
        return this._request('POST', '/classroom-groups/migrate', {}, idToken);
    }

    /**
     * Manage the class's topic list. Rename/remove cascade to assignments.
     * @param {string} idToken - Teacher ID token
     * @param {string} groupId - Group (class) ID
     * @param {object} payload - {action: 'add'|'remove'|'rename', name, to?}
     * @returns {Promise<object>} Updated group summary
     */
    async updateGroupTopics(idToken, groupId, payload) {
        return this._request('PATCH', `/classroom-groups/${groupId}/topics`, payload, idToken);
    }

    /**
     * List the teacher's groups (active and archived).
     * @param {string} idToken - Teacher ID token
     * @returns {Promise<object>} {groups}
     */
    async listGroups(idToken) {
        return this._request('GET', '/classroom-groups', null, idToken);
    }

    /**
     * Update a group (rename / change year / archive / unarchive).
     * @param {string} idToken - Teacher ID token
     * @param {string} groupId - Group ID
     * @param {object} updates - {name?, year?, status?}
     * @returns {Promise<object>} Updated group
     */
    async updateGroup(idToken, groupId, updates) {
        return this._request('PATCH', `/classroom-groups/${groupId}`, updates, idToken);
    }

    /**
     * Duplicate a classroom (lesson) with its assignment content.
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Source classroom ID
     * @param {object} [options] - {groupId?, className?, assignmentName?}
     * @returns {Promise<object>} Created classroom
     */
    async duplicateClassroom(idToken, classroomId, options = {}) {
        return this._request('POST', `/classrooms/${classroomId}/duplicate`, options, idToken);
    }

    /**
     * AI evaluation support: grade proposals or comment drafts from
     * static-analysis results (max 10 submissions per call — chunk a class).
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @param {object} payload - {mode, assignmentName, assignmentText,
     *   rubricAxes, strictness, samples, submissions}
     * @returns {Promise<object>} {mode, results}
     */
    async evaluateSubmissions(idToken, classroomId, payload) {
        return this._request('POST', `/classrooms/${classroomId}/evaluate`, payload, idToken);
    }

    /**
     * Set (replace) the assignment content of a classroom (teacher only).
     * Pages carry either `newImage` (MIME type, requests a fresh upload URL)
     * or `imageKey` (keep the existing object). `newStarter` / `keepStarter`
     * control the starter project. An empty payload clears the assignment.
     * @param {string} idToken - Teacher ID token
     * @param {string} classroomId - Classroom ID
     * @param {object} payload - {pages, newStarter, keepStarter}
     * @returns {Promise<object>} {assignment, imageUploadUrls, starterUploadUrl}
     */
    async setAssignment(idToken, classroomId, payload) {
        return this._request('PUT', `/classrooms/${classroomId}/assignment`, payload, idToken);
    }

    /**
     * Get the assignment content of a classroom with download URLs.
     * Accepts either a teacher ID token or a student session token.
     * @param {string} token - Teacher ID token or student session token
     * @param {string} classroomId - Classroom ID
     * @returns {Promise<object>} {assignment} — null when no assignment is set
     */
    async getAssignment(token, classroomId) {
        return this._request('GET', `/classrooms/${classroomId}/assignment`, null, token);
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
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
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
                await new Promise((r) => setTimeout(r, delay + jitter));
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                lastError = new Error(errorData.error || `API error ${response.status}`);
                lastError.status = response.status;
                // Surface the parsed body so callers can read response-specific
                // fields (e.g. 410 + reason='kicked' carries joinCode/className/
                // seatNumber that the kick-banner UI needs).
                lastError.body = errorData;
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
