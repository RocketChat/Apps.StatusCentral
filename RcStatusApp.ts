import { IncidentCommand } from './commands/IncidentCommand';
import { SettingsEnum } from './enums/settings';
import { SettingToHttpHeader } from './handlers/settingToHttpHeader';
import { IncidentCreationWorker } from './workers/creation';
import { HttpWorker } from './workers/http';

import {
    IConfigurationExtend,
    IConfigurationModify,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export class RcStatusApp extends App {
    private hw: HttpWorker;
    private icw: IncidentCreationWorker;

    constructor(info: IAppInfo, logger: ILogger) {
        super(info, logger);

        this.hw = new HttpWorker();
        this.icw = new IncidentCreationWorker(this);
    }

    public async onEnable(er: IEnvironmentRead, cm: IConfigurationModify): Promise<boolean> {
        const apiKey = await er.getSettings().getValueById(SettingsEnum.API_KEY);

        if (!apiKey) {
            await cm.slashCommands.disableSlashCommand('incident');
        }

        return true;
    }

    public async initialize(configurationExtend: IConfigurationExtend): Promise<void> {
        await configurationExtend.slashCommands.provideSlashCommand(new IncidentCommand(this));

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.SERVER_URL,
            type: SettingType.STRING,
            required: true,
            public: false,
            packageValue: 'status.rocket.chat',
            i18nLabel: 'Server_Url',
            i18nDescription: 'Server_Url_Description',
        });

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.API_KEY,
            type: SettingType.STRING,
            required: true,
            public: false,
            packageValue: '',
            i18nLabel: 'Api_Key',
            i18nDescription: 'Api_Key_Description',
        });

        await configurationExtend.http.providePreRequestHandler(new SettingToHttpHeader());
    }

    public async onSettingUpdated(setting: ISetting, cm: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        switch (setting.id) {
            case SettingsEnum.API_KEY:
                await this.handleApiKeySettingHandle(setting, cm, read, http);
                break;
        }
    }

    public getCreationWorker(): IncidentCreationWorker {
        return this.icw;
    }

    public getHttpWorker(): HttpWorker {
        return this.hw;
    }

    private async handleApiKeySettingHandle(setting: ISetting, cm: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        if (setting.value) {
            if (await this.hw.testApi(read, http)) {
                this.getLogger().log('Enabling the slash command.');
                await cm.slashCommands.enableSlashCommand('incident');
            } else {
                 // The api key is not valid
                 this.getLogger().log('Disabling the slash command because the api key isn\'t valid.');
                 await cm.slashCommands.disableSlashCommand('incident');
            }
        } else {
            // There is no value, so remove the command
            this.getLogger().log('Disabling the slash command because there is no setting value defined.');
            await cm.slashCommands.disableSlashCommand('incident');
        }
    }
}
