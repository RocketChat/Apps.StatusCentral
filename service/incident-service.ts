import { HttpStatusCode, IHttp, IHttpRequest, ILogger, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SettingsEnum } from '../models/enum/settings-enum';
import { Incident } from '../models/incident';
import { IncidentUpdate } from '../models/incident-update';

export class IncidentService {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public async create(incident: Partial<Incident>, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SSL);

        const options: IHttpRequest = { data: incident };
        const result = await http.post(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/incidents`, options);
        if (!result) {
            throw new Error(`Failure to create the incident in statuscentral. Check if the service is available.`);
        }

        if (result.statusCode !== HttpStatusCode.CREATED) {
            if (result.data && result.data.message) {
                throw new Error(`Failure to create the incident: ${ result.data.message } (status: ${ result.statusCode })`);
            } else {
                throw new Error(`Failure to create the incident: "${ result.content }" (status: ${ result.statusCode })`);
            }
        }

        return result.data as Incident;
    }

    public async createUpdate(id: number, incidentUpdate: Partial<IncidentUpdate>, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SSL);

        const options: IHttpRequest = { data: incidentUpdate };
        const result = await http.post(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/incidents/${ id }/updates`, options);
        if (!result) {
            throw new Error(`Failure to create the incident update in statuscentral. Check if the service is available.`);
        }

        if (result.statusCode !== HttpStatusCode.CREATED) {
            throw new Error(`Failure to create the incident update: ${ result.data.message } (status: ${ result.statusCode })`);
        }

        return result.data as Incident;
    }

    public async get(id: string, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SSL);

        const result = await http.get(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/incidents/${ id }`);
        if (!result) {
            throw new Error(`Failure to retrieve the incident from statuscentral. Check if the service is available.`);
        }

        if (result.statusCode !== HttpStatusCode.OK) {
            throw new Error(`Failure to retrieve the incident: ${ result.data.message } (status: ${ result.statusCode })`);
        }

        return result.data as Incident;
    }
}
