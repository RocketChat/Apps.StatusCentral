import { SettingsEnum } from './../enums/settings';

import { HttpStatusCode, IHttp, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IServiceModel } from '../models/service';

export class HttpWorker {
    public async testApi(read: IRead, http: IHttp): Promise<boolean> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);

        const result = await http.get(`http://${ url }/api/v1/config`);

        return result.statusCode === HttpStatusCode.OK;
    }

    public async retrieveServices(read: IRead, http: IHttp): Promise<Array<IServiceModel>> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);

        const result = await http.get(`http://${ url }/api/v1/services`);

        return result.data as Array<IServiceModel>;
    }
}
