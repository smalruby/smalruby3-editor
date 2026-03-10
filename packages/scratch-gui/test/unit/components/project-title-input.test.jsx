// === Smalruby: This file is Smalruby-specific (project title input disabled when Google Drive file) ===
import React from 'react';
import configureStore from 'redux-mock-store';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';

import ProjectTitleInput from '../../../src/components/menu-bar/project-title-input.jsx';

describe('ProjectTitleInput', () => {
    const mockStore = configureStore();

    test('should be disabled when isGoogleDriveFile is true', () => {
        const store = mockStore({
            scratchGui: {
                projectTitle: 'test-project',
                googleDriveFile: {
                    isGoogleDriveFile: true
                }
            }
        });

        const {container} = renderWithIntl(
            <ProjectTitleInput store={store} />
        );

        const input = container.querySelector('input');
        expect(input).not.toBeNull();
        expect(input.disabled).toBe(true);
    });

    test('should be editable when isGoogleDriveFile is false', () => {
        const store = mockStore({
            scratchGui: {
                projectTitle: 'test-project',
                googleDriveFile: {
                    isGoogleDriveFile: false
                }
            }
        });

        const {container} = renderWithIntl(
            <ProjectTitleInput store={store} />
        );

        const input = container.querySelector('input');
        expect(input).not.toBeNull();
        expect(input.disabled).toBe(false);
    });
});
