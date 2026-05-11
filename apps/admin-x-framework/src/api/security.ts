import {createMutation} from '../utils/api/hooks';

export interface SecurityActionResponse {
    security_action: Array<{
        action: 'rotate_api_keys';
        count: number;
    }>;
}

export const useRotateApiKeys = createMutation<SecurityActionResponse, null>({
    method: 'POST',
    path: () => '/security/rotate_api_keys/'
});
