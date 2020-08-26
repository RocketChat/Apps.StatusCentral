import { HttpStatusCode, IHttp, ILogger, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { SettingsEnum } from '../models/enum/settings-enum';

export class ConfigService {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public async get(read: IRead, http: IHttp): Promise<boolean> {
        const url = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL);
        const ssl = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.SERVER_URL_USE_SSL);

        this.logger.log(url);
        this.logger.log(ssl);

        const result = await http.get(`${ ssl ? 'https' : 'http' }://${ url }/api/v1/config`);
        if (!result) {
            throw new Error(`Failure to retrieve the statuscentral configuration. Check if the service is available.`);
        }

        return result.statusCode === HttpStatusCode.OK;
    }
}
