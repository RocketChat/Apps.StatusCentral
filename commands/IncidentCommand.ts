import { SettingsEnum } from './../enums/settings';
import { RcStatusApp } from './../RcStatusApp';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { IncidentService } from '../service/incident-service';
import { CloudServicesService } from '../service/cloud-services-service';
import { IncidentStatusEnum } from '../enums/incidentStatus';
import { ServiceStatusEnum } from '../enums/serviceStatus';

export class IncidentCommand implements ISlashCommand {
    public command = 'incident';
    public i18nParamsExample = 'Incident_Command_Params_Example';
    public i18nDescription = 'Incident_Command_Description';
    public permission = 'view-logs';
    public providesPreview = false;
    private app: RcStatusApp;
    private incidentService: IncidentService;
    private cloudServicesService: CloudServicesService;

    constructor(app: RcStatusApp, incidentService: IncidentService, cloudServicesService: CloudServicesService) {
        this.app = app;
        this.incidentService = incidentService;
        this.cloudServicesService = cloudServicesService;
    }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const expectedRoomId = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.ROOM_ID);

        if (expectedRoomId !== context.getRoom().id) {
            return await this.handleIncorrectRoom(context, modify);
        }

        const members = await read.getRoomReader().getMembers(expectedRoomId);

        if (members.filter((m) => m.username.toLowerCase() === 'rocket.cat').length === 0) {
            this.app.getLogger().warn('The Rocket.Cat user is not in the room.');
            return await this.haveThemInviteRocketCatUser(context, modify);
        }

        console.log(context.getArguments().length)
        this.app.getLogger().log(context.getArguments().length)

        switch (context.getArguments().length) {
            case 0:
                return this.handleNoArguments(context, read, modify, http);
            case 1:
                return this.handleOneArgument(context, read, modify, http);
            default:
                return this.handleNoArguments(context, read, modify, http);
        }
    }

    private async handleNoArguments(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        const message = modify.getCreator().startMessage()
            .setGroupable(false)
            .setRoom(context.getRoom())
            .setUsernameAlias('Houston Control')
            .setText('Invalid syntax. Use: `/incident <create|update|close>`');
        await modify.getNotifier().notifyUser(context.getSender(), message.getMessage());
    }

    private async handleOneArgument(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        let message = modify.getCreator().startMessage()
            .setRoom(context.getRoom())
            .setUsernameAlias('Houston Control')
            .setGroupable(false);

        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
                const triggerId = context.getTriggerId();
                if (triggerId) {
                    try {
                        const incidentStatus = Object.keys(IncidentStatusEnum).map((key) => ({id: key, name: IncidentStatusEnum[key]}));
                        const cloudServices = await this.cloudServicesService.get(read, http);
                        const cloudServiceStatus = Object.keys(ServiceStatusEnum).map((key) => ({id: key, name: ServiceStatusEnum[key]}));
    
                        this.app.incidentCreateView.setState(incidentStatus, cloudServices, [], cloudServiceStatus, context.getRoom());
                        const view = await this.app.incidentCreateView.renderAsync(modify);
                        return await modify.getUiController().openModalView(view, { triggerId }, context.getSender());    
                    } catch (err) {
                        this.app.getLogger().log(`An error occured during the incident creation request. Error: ${err}`);
                        message = message.setText('An error occured during the incident creation request. Please, try again later');
                        break;
                    }
                } else {
                    break;
                }
            case 'update':
                message = message.setText('Invalid syntax. Update uses: `/incident update <id of incident>`');
                break;
            case 'close':
                message = message.setText('Invalid syntax. Close uses: `/incident close <id of incident>`');
                break;
            default:
                message = modify.getCreator().startMessage()
                    .setGroupable(false)
                    .setRoom(context.getRoom())
                    .setUsernameAlias('Houston Control')
                    .setText('Invalid syntax. Use: `/incident <create|update|close>`');
        }

        await modify.getNotifier().notifyUser(context.getSender(), message.getMessage());
    }

    /*
    private async handleTwoArguments(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
            case 'explain':
                return this.handleEverythingElse(context, read, modify, http, persis);
            case 'update':
                return this.app.getUpdateWorker().start(context, read, modify, http, persis);
            case 'remove':
                this.app.getLogger().log(context.getArguments().join(' '));
                break;
            case 'abort':
                return this.handleOneArgument(context, read, modify, http, persis);
            default:
                return this.handleNoArguments(context, modify);
        }
    }
    */

    private async handleIncorrectRoom(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator()
                .startMessage().setRoom(context.getRoom())
                .setUsernameAlias('Houston Control').setGroupable(false)
                .setText(`Unexpected room. The room you're in (\`${ context.getRoom().id }\`) is not the expected room.`);

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }

    private async haveThemInviteRocketCatUser(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator()
                .startMessage().setRoom(context.getRoom())
                .setUsernameAlias('Houston Control').setGroupable(false)
                .setText(`Please invite the @rocket.cat user. (\`/invite @rocket.cat\`)`);

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }
}
