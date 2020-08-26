import { IncidentStatusApi } from './api/incident';
import { ProcessStepperApi } from './api/process';
import { ServiceSelectionApi } from './api/service';
import { StatusSelectionApi } from './api/status';
import { UpdateStatusApi } from './api/update';
import { IncidentCommand } from './commands/IncidentCommand';
import { SettingsEnum } from './enums/settings';
import { SettingToHttpHeader } from './handlers/settingToHttpHeader';
import { IncidentAbortWorker } from './workers/abort';
import { IncidentCreationWorker } from './workers/creation';
import { HttpWorker } from './workers/http';
import { IncidentUpdateWorker } from './workers/update';

import {
    IConfigurationExtend,
    IConfigurationModify,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import {
    IUIKitInteractionHandler,
    UIKitBlockInteractionContext,
    UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';
import { IncidentsCreateView } from './view/incident/create-incident-view';
import { IncidentService } from './service/incident-service';
import { CloudServicesService } from './service/cloud-services-service';
import { IncidentStatusEnum } from './enums/incidentStatus';
import { ServiceStatusEnum } from './enums/serviceStatus';

export class RcStatusApp extends App implements IUIKitInteractionHandler {
    private hw: HttpWorker;
    private iaw: IncidentAbortWorker;
    private icw: IncidentCreationWorker;
    private iuw: IncidentUpdateWorker;
    private incidentService: IncidentService;
    private cloudServicesService: CloudServicesService;
    public incidentCreateView: IncidentsCreateView;

    constructor(info: IAppInfo, logger: ILogger) {
        super(info, logger);

        this.hw = new HttpWorker(this);
        this.iaw = new IncidentAbortWorker();
        this.icw = new IncidentCreationWorker(this);
        this.iuw = new IncidentUpdateWorker(this);
        this.incidentService = new IncidentService(logger);
        this.cloudServicesService = new CloudServicesService(logger);
        this.incidentCreateView = new IncidentsCreateView(logger, this.incidentService);
    }

    public async onEnable(er: IEnvironmentRead, cm: IConfigurationModify): Promise<boolean> {
        const apiKey = await er.getSettings().getValueById(SettingsEnum.API_KEY);

        if (!apiKey) {
            await cm.slashCommands.disableSlashCommand('incident');
        }

        return true;
    }

    public async executeViewSubmitHandler(context: UIKitViewSubmitInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const data = context.getInteractionData();
        switch (data.view.id) {
            case 'incident_create_view': {
                try {
                    await this.incidentCreateView.onSubmitAsync(data.view.state, modify, read, http);
                    return {
                        success: true,
                    };
                } catch (err) {
                    console.log(err);
                    this.getLogger().log(err);
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: err,
                    });
                }
            }
            default: {
                return {
                    success: true,
                };
            }
        }
    }

    public async executeBlockActionHandler(context: UIKitBlockInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const data = context.getInteractionData();
        switch (data.actionId) {
            case 'vinc_services_multi_select': {
                if (data.value) {
                    const incidentStatus = Object.keys(IncidentStatusEnum).map((key) => ({id: key, name: IncidentStatusEnum[key]}));
                    const cloudServices = await this.cloudServicesService.get(read, http);
                    const cloudServiceStatus = Object.keys(ServiceStatusEnum).map((key) => ({id: key, name: ServiceStatusEnum[key]}));
                    const cloudServicesSelected = <any> data.value

                    this.incidentCreateView.setState(incidentStatus, cloudServices, cloudServicesSelected, cloudServiceStatus)
                    return context.getInteractionResponder().updateModalViewResponse(await this.incidentCreateView.renderAsync(modify));
                }
            }
            default: {
                return {
                    success: true,
                    triggerId: data.triggerId,
                }; 
            }
        }
    }

    public async initialize(configurationExtend: IConfigurationExtend): Promise<void> {
        await configurationExtend.slashCommands.provideSlashCommand(new IncidentCommand(this, this.incidentService, this.cloudServicesService));

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.SERVER_URL,
            type: SettingType.STRING,
            required: true,
            public: false,
            packageValue: 'statuscentral:5050',
            i18nLabel: 'Server_Url',
            i18nDescription: 'Server_Url_Description',
        });

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.SERVER_URL_USE_SLL,
            type: SettingType.BOOLEAN,
            required: true,
            public: false,
            packageValue: false,
            i18nLabel: 'Server_Url_Ssl',
            i18nDescription: 'Server_Url_Ssl_Description',
        });

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.API_KEY,
            type: SettingType.STRING,
            required: true,
            public: false,
            packageValue: 'abc123def456',
            i18nLabel: 'Api_Key',
            i18nDescription: 'Api_Key_Description',
        });

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.ROOM_ID,
            type: SettingType.STRING,
            required: true,
            public: false,
            packageValue: 'YkKZaT9DZPx6ELoMq',
            i18nLabel: 'Room_Id',
            i18nDescription: 'Room_Id_Description',
        });

        await configurationExtend.http.providePreRequestHandler(new SettingToHttpHeader());

        await configurationExtend.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new ProcessStepperApi(this),
                new IncidentStatusApi(this),
                new ServiceSelectionApi(this),
                new StatusSelectionApi(this),
                new UpdateStatusApi(this),
            ],
        });
    }

    public async onSettingUpdated(setting: ISetting, cm: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        switch (setting.id) {
            case SettingsEnum.API_KEY:
                await this.handleApiKeySettingHandle(setting, cm, read, http);
                break;
        }
    }

    public getAbortWorker(): IncidentAbortWorker {
        return this.iaw;
    }

    public getCreationWorker(): IncidentCreationWorker {
        return this.icw;
    }

    public getUpdateWorker(): IncidentUpdateWorker {
        return this.iuw;
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
