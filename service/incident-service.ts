import { SettingsEnum } from '../enums/settings';
import { Incident } from '../models/incident';
import { HttpStatusCode, IHttp, IHttpRequest, IRead, ILogger } from '@rocket.chat/apps-engine/definition/accessors';
import { IncidentUpdate } from '../models/incident-update';

export class IncidentService {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public async create(incident: Partial<Incident>, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const options: IHttpRequest = { data: incident };
        const result = await http.post(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/incidents`, options);
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

        return <Incident> result.data;
    }

    public async createUpdate(id: number, incidentUpdate: Partial<IncidentUpdate>, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const options: IHttpRequest = { data: incidentUpdate };
        const result = await http.get(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/incidents/${ id }/updates`, options);
        if (!result) {
            throw new Error(`Failure to create the incident update, is the status page even up?`);
        }

        if (result.statusCode !== HttpStatusCode.CREATED) {
            throw new Error(`Failure to create the incident: ${ result.data.message } (${ result.statusCode })`);
        }

        return <Incident> result.data;
    }

    public async get(id: string, read: IRead, http: IHttp): Promise<Incident> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const result = await http.get(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/incidents/${ id }`);
        if (!result) {
            throw new Error(`Failure to retrieve the incident, is the status page even up?`);
        }

        if (result.statusCode !== HttpStatusCode.OK) {
            throw new Error(`Failure to get the incident: ${ result.data.message } (${ result.statusCode })`);
        }

        return <Incident> result.data;
    }
}