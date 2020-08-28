import { IncidentCommand } from './commands/incident-command';
import { SettingsEnum } from './models/enum/settings-enum';
import { HttpAuthHandler } from './handlers/http-auth-handler';
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
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import {
    IUIKitInteractionHandler,
    UIKitBlockInteractionContext,
    UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';
import { IncidentCreateView } from './view/incident/create-incident-view';
import { IncidentUpdateView } from './view/incident/update-incident-view';
import { IncidentCloseView } from './view/incident/close-incident-view';
import { IncidentService } from './service/incident-service';
import { ServiceService } from './service/service-service';
import { ConfigService } from './service/config-service';

export class HoustonControl extends App implements IUIKitInteractionHandler {
    private configService: ConfigService;
    private incidentService: IncidentService;
    private servicesService: ServiceService;

    private incidentCreateView: IncidentCreateView;
    private incidentUpdateView: IncidentUpdateView; 
    private incidentCloseView: IncidentCloseView;
    
    constructor(info: IAppInfo, logger: ILogger) {
        super(info, logger);

        this.configService = new ConfigService(logger);
        this.incidentService = new IncidentService(logger);
        this.servicesService = new ServiceService(logger);

        this.incidentCreateView = new IncidentCreateView(logger, this.incidentService);
        this.incidentUpdateView = new IncidentUpdateView(logger, this.incidentService);   
        this.incidentCloseView = new IncidentCloseView(logger, this.incidentService);     
    }

    public getIncidentCreateView() {
        return this.incidentCreateView;
    }

    public getIncidentUpdateView() {
        return this.incidentUpdateView;
    }

    public getIncidentCloseView() {
        return this.incidentCloseView;
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
                    await this.getIncidentCreateView().onSubmitAsync(data.view.state, modify, read, http);
                    return {
                        success: true,
                    };
                } catch (err) {
                    this.getLogger().log(`An error occured during the incident creation. Error: ${err}`)
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: {
                            vinc_title_input_value: 'An error occured during the incident creation. Please try again.'
                        }
                    });
                }
            }
            case 'incident_update_view': {
                try {
                    await this.getIncidentUpdateView().onSubmitAsync(data.view.state, modify, read, http);
                    return {
                        success: true,
                    };
                } catch (err) {
                    this.getLogger().log(`An error occured during the incident update. Error: ${err}`)
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: {
                            vinup_message_input_value: 'An error occured during the incident update. Please try again.'
                        }
                    });
                }
            }
            case 'incident_close_view': {
                try {
                    await this.getIncidentCloseView().onSubmitAsync(data.view.state, modify, read, http);
                    return {
                        success: true,
                    };
                } catch (err) {
                    this.getLogger().log(`An error occured during the incident closing. Error: ${err}`)
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: {
                            vinup_message_input_value: 'An error occured during the incident closing. Please try again.'
                        }
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
                    const servicesSelected = <any> data.value;
                    this.incidentCreateView.setState(servicesSelected);
                    return context.getInteractionResponder().updateModalViewResponse(await this.getIncidentCreateView().renderAsync(modify));
                }
            }
            case 'vinc_users_multi_select': {
                if (data.value) {
                    const roomUsersSelected = <any> data.value;
                    this.incidentCreateView.setState(undefined, roomUsersSelected);
                    return context.getInteractionResponder().updateModalViewResponse(await this.getIncidentCreateView().renderAsync(modify));
                }
            }
            case 'vinup_services_multi_select': {
                if (data.value) {
                    const servicesSelected = <any> data.value;
                    this.getIncidentUpdateView().setState(servicesSelected);
                    return context.getInteractionResponder().updateModalViewResponse(await this.getIncidentUpdateView().renderAsync(modify));
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
        await configurationExtend.slashCommands.provideSlashCommand(new IncidentCommand(this, this.incidentService, this.servicesService));

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
            id: SettingsEnum.SERVER_URL_USE_SLL,
            type: SettingType.BOOLEAN,
            required: true,
            public: false,
            packageValue: true,
            i18nLabel: 'Server_Url_Ssl',
            i18nDescription: 'Server_Url_Ssl_Description',
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

        await configurationExtend.settings.provideSetting({
            id: SettingsEnum.ROOM_ID,
            type: SettingType.STRING,
            required: true,
            public: false,
            packageValue: '',
            i18nLabel: 'Room_Id',
            i18nDescription: 'Room_Id_Description',
        });

        await configurationExtend.http.providePreRequestHandler(new HttpAuthHandler());
    }

    public async onSettingUpdated(setting: ISetting, cm: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        switch (setting.id) {
            case SettingsEnum.API_KEY:
                await this.handleApiKeySettingHandle(setting, cm, read, http);
                break;
        }
    }

    private async handleApiKeySettingHandle(setting: ISetting, cm: IConfigurationModify, read: IRead, http: IHttp): Promise<void> {
        if (setting.value) {
            if (await this.configService.get(read, http)) {
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
