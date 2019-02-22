import { SettingsEnum } from './../enums/settings';
import { RcStatusApp } from './../RcStatusApp';

import { IHttp, IMessageBuilder, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

export class IncidentCommand implements ISlashCommand {
    public command = 'incident';
    public i18nParamsExample = 'Incident_Command_Params_Example';
    public i18nDescription = 'Incident_Command_Description';
    public permission = 'view-logs';
    public providesPreview = false;
    private app: RcStatusApp;

    constructor(app: RcStatusApp) {
        this.app = app;
    }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const expectedRoomId = await read.getEnvironmentReader().getSettings().getValueById(SettingsEnum.ROOM_ID);

        if (expectedRoomId !== context.getRoom().id) {
            return await this.handleIncorrectRoom(context, modify);
        }

        this.app.getLogger().log('testing');

        if (!context.getRoom().usernames.includes('rocket.cat')) {
            return await this.haveThemInviteRocketCatUser(context, modify);
        }

        switch (context.getArguments().length) {
            case 0:
                return this.handleNoArguments(context, modify);
            case 1:
                return this.handleOneArgument(context, read, modify, http, persis);
            case 2:
                return this.handleTwoArguments(context, read, modify, http, persis);
            default:
                return this.handleEverythingElse(context, read, modify, http, persis);
        }
    }

    private async handleNoArguments(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator().startMessage()
            .setGroupable(false)
            .setRoom(context.getRoom())
            .setUsernameAlias('RC Status')
            .setText('Invalid syntax. Use: `/incident <create|describe|update|remove|abort>`');

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }

    private async handleOneArgument(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        let msg = modify.getCreator().startMessage().setRoom(context.getRoom()).setUsernameAlias('RC Status').setGroupable(false);

        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
                msg = msg.setText('Invalid syntax. Creation uses: `/incident create <title of incident>`');
                break;
            case 'describe':
                msg = msg.setText('Invalid syntax. Creation uses: `/incident describe <brief description of the incident>`');
                break;
            case 'update':
                msg = msg.setText('Invalid syntax. Creation uses: `/incident update <id of incident>`');
                break;
            case 'remove':
                msg = msg.setText('Invalid syntax. Creation uses: `/incident remove <id of incident>`');
                break;
            case 'abort':
                return this.app.getAbortWorker().abort(context, read, modify, http, persis);
            default:
                return this.handleNoArguments(context, modify);
        }

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }

    private async handleTwoArguments(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
            case 'describe':
                return this.handleEverythingElse(context, read, modify, http, persis);
            case 'update':
                this.app.getLogger().log(context.getArguments().join(' '));
                break;
            case 'remove':
                this.app.getLogger().log(context.getArguments().join(' '));
                break;
            case 'abort':
                return this.handleOneArgument(context, read, modify, http, persis);
            default:
                return this.handleNoArguments(context, modify);
        }
    }

    private async handleEverythingElse(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        switch (context.getArguments()[0].toLowerCase()) {
            case 'create':
                return this.app.getCreationWorker().start(context, read, modify, persis);
            case 'describe':
                return this.app.getCreationWorker().saveDescription(context, read, modify, http, persis);
            case 'abort':
                return this.handleOneArgument(context, read, modify, http, persis);
            default:
                return this.handleNoArguments(context, modify);
        }
    }

    private async handleIncorrectRoom(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator()
                .startMessage().setRoom(context.getRoom())
                .setUsernameAlias('RC Status').setGroupable(false)
                .setText(`Unexpected room. The room you're in (\`${ context.getRoom().id }\`) is not the expected room.`);

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }

    private async haveThemInviteRocketCatUser(context: SlashCommandContext, modify: IModify): Promise<void> {
        const msg = modify.getCreator()
                .startMessage().setRoom(context.getRoom())
                .setUsernameAlias('RC Status').setGroupable(false)
                .setText(`Please invite the @rocket.cat user. (\`/invite @rocket.cat\`)`);

        await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
    }
}
