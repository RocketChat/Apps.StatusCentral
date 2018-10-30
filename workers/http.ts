import { SettingsEnum } from './../enums/settings';
import { IIncidentModel } from './../models/incident';
import { RcStatusApp } from './../RcStatusApp';

import { HttpStatusCode, IHttp, IHttpRequest, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IServiceModel } from '../models/service';

export class HttpWorker {
    constructor(private app: RcStatusApp) { }

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

    public async createIncident(data: Partial<IIncidentModel>, read: IRead, http: IHttp): Promise<void> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);

        const options: IHttpRequest = {
            data,
        };

        const result = await http.post(`http://${ url }/api/v1/incidents`, options);

        if (result.statusCode !== HttpStatusCode.CREATED) {
            throw new Error(`Failure to create the incident: ${ result.data.message } (${ result.statusCode })`);
        }
    }
}
