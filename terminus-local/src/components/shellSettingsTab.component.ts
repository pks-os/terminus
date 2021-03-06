import { Component } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { ConfigService, HostAppService, Platform, WIN_BUILD_CONPTY_SUPPORTED, WIN_BUILD_CONPTY_STABLE, isWindowsBuild } from 'terminus-core'
import { ElectronService, ElectronHostWindow } from 'terminus-electron'
import { EditProfileModalComponent } from './editProfileModal.component'
import { Shell, Profile } from '../api'
import { TerminalService } from '../services/terminal.service'

/** @hidden */
@Component({
    template: require('./shellSettingsTab.component.pug'),
})
export class ShellSettingsTabComponent {
    shells: Shell[] = []
    profiles: Profile[] = []
    Platform = Platform
    isConPTYAvailable: boolean
    isConPTYStable: boolean
    private configSubscription: Subscription

    constructor (
        public config: ConfigService,
        public hostApp: HostAppService,
        public hostWindow: ElectronHostWindow,
        public terminal: TerminalService,
        private electron: ElectronService,
        private ngbModal: NgbModal,
    ) {
        config.store.terminal.environment = config.store.terminal.environment || {}
        this.configSubscription = this.config.changed$.subscribe(() => {
            this.reload()
        })
        this.reload()

        this.isConPTYAvailable = isWindowsBuild(WIN_BUILD_CONPTY_SUPPORTED)
        this.isConPTYStable = isWindowsBuild(WIN_BUILD_CONPTY_STABLE)
    }

    async ngOnInit (): Promise<void> {
        this.shells = (await this.terminal.shells$.toPromise())!
    }

    ngOnDestroy (): void {
        this.configSubscription.unsubscribe()
    }

    async reload (): Promise<void> {
        this.profiles = await this.terminal.getProfiles({ includeHidden: true })
    }

    async pickWorkingDirectory (): Promise<void> {
        const profile = await this.terminal.getProfileByID(this.config.store.terminal.profile)
        const shell = this.shells.find(x => x.id === profile?.shell)
        if (!shell) {
            return
        }
        const paths = (await this.electron.dialog.showOpenDialog(
            this.hostWindow.getWindow(),
            {
                defaultPath: shell.fsBase,
                properties: ['openDirectory', 'showHiddenFiles'],
            }
        )).filePaths
        this.config.store.terminal.workingDirectory = paths[0]
    }

    newProfile (shell: Shell): void {
        const profile: Profile = {
            name: shell.name ?? '',
            shell: shell.id,
            sessionOptions: this.terminal.optionsFromShell(shell),
        }
        this.config.store.terminal.profiles = [profile, ...this.config.store.terminal.profiles]
        this.config.save()
        this.reload()
    }

    editProfile (profile: Profile): void {
        const modal = this.ngbModal.open(EditProfileModalComponent)
        modal.componentInstance.profile = Object.assign({}, profile)
        modal.result.then(result => {
            Object.assign(profile, result)
            this.config.save()
        })
    }

    deleteProfile (profile: Profile): void {
        this.config.store.terminal.profiles = this.config.store.terminal.profiles.filter(x => x !== profile)
        this.config.save()
        this.reload()
    }
}
