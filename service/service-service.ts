import { HttpStatusCode, IHttp, ILogger, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SettingsEnum } from '../models/enum/settings-enum';
import { Service } from '../models/service';

export class ServiceService {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public async get(read: IRead, http: IHttp): Promise<Array<Service>> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SLL);

        const result = await http.get(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/services`);
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
}
