import {
    IHttpPreRequestHandler,
    IHttpRequest,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';

import { SettingsEnum } from '../enums/settings';

export class SettingToHttpHeader implements IHttpPreRequestHandler {
    public async executePreHttpRequest(url: string, request: IHttpRequest, read: IRead, persis: IPersistence): Promise<IHttpRequest> {
        const apiKey = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.API_KEY);

        if (typeof apiKey !== 'string' || apiKey.length === 0) {
            throw new Error('Invalid Api Key!');
        }

        if (typeof request.headers === 'undefined') {
            request.headers = { };
        }

        request.headers.Authorization = apiKey;

        return request;
    }
}
