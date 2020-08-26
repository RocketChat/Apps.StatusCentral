import { IncidentUpdate } from '../models/incident-update';
import { Service } from '../models/service';
import { SettingsEnum } from './../enums/settings';
import { Incident } from './../models/incident';
import { RcStatusApp } from './../RcStatusApp';

import { HttpStatusCode, IHttp, IHttpRequest, IRead } from '@rocket.chat/apps-engine/definition/accessors';

export class HttpWorker {
    constructor(private app: RcStatusApp) { }

    public async testApi(read: IRead, http: IHttp): Promise<boolean> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const useSsl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        this.app.getLogger().log(url);
        this.app.getLogger().log(useSsl);

        const result = await http.get(`http${ useSsl ? 's' : '' }://${ url }/api/v1/config`);

        return result.statusCode === HttpStatusCode.OK;
    }

    public async retrieveServices(read: IRead, http: IHttp): Promise<Array<Service>> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const useSsl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        this.app.getLogger().log('the ssl setting is:', useSsl, 'and the url is:', `http${ useSsl ? 's' : '' }://${ url }/api/v1/services`);

        const result = await http.get(`http${ useSsl ? 's' : '' }://${ url }/api/v1/services`);

        if (!result) {
            throw new Error(`Failure to retreive the services, is the status page even up?`);
        }

        if (result.statusCode !== HttpStatusCode.OK) {
            if (result.data && result.data.message) {
                throw new Error(`Failure to retreive the services: ${ result.data.message } (Status Code ${ result.statusCode })`);
            } else {
                throw new Error(`Failure to retreive the services: "${ result.content }" (Status Code ${ result.statusCode })`);
            }
        }

        return result.data as Array<Service>;
    }

    public async createIncident(data: Partial<Incident>, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const useSsl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const options: IHttpRequest = {
            data,
        };

        const result = await http.get(`http${ useSsl ? 's' : '' }://${ url }/api/v1/incidents`, options);

        if (!result) {
            throw new Error(`Failure to create the incident, is the status page even up?`);
        }

        if (result.statusCode !== HttpStatusCode.CREATED) {
            if (result.data && result.data.message) {
                throw new Error(`Failure to create the incident: ${ result.data.message } (Status Code ${ result.statusCode })`);
            } else {
                throw new Error(`Failure to create the incident: "${ result.content }" (Status Code ${ result.statusCode })`);
            }
        }

        return result.data as Incident;
    }

    public async getIncident(id: string, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const useSsl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const result = await http.get(`http${ useSsl ? 's' : '' }://${ url }/api/v1/incidents/${ id }`);

        if (!result) {
            throw new Error(`Failure to retrieve the incident, is the status page even up?`);
        }

        if (result.statusCode !== HttpStatusCode.OK) {
            throw new Error(`Failure to get the incident: ${ result.data.message } (${ result.statusCode })`);
        }

        return result.data as Incident;
    }

    public async createUpdate(id: number, update: Partial<IncidentUpdate>, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const useSsl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const options: IHttpRequest = {
            data: update,
        };

        const result = await http.get(`http${ useSsl ? 's' : '' }://${ url }/api/v1/incidents/${ id }/updates`, options);

        if (!result) {
            throw new Error(`Failure to create the incident update, is the status page even up?`);
        }

        if (result.statusCode !== HttpStatusCode.CREATED) {
            throw new Error(`Failure to create the incident: ${ result.data.message } (${ result.statusCode })`);
        }

        return result.data as Incident;
    }
}
