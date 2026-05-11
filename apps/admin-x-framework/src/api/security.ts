import {createMutation} from '../utils/api/hooks';

export interface SecurityActionResponse {
    security_action: Array<{
        action: 'rotate_api_keys' | 'reset_staff_passwords';
        count: number;
    }>;
}

export const useRotateApiKeys = createMutation<SecurityActionResponse, null>({
    method: 'POST',
    path: () => '/security/rotate_api_keys/'
});

export const useResetStaffPasswords = createMutation<SecurityActionResponse, null>({
    method: 'POST',
    path: () => '/security/reset_staff_passwords/'
});
