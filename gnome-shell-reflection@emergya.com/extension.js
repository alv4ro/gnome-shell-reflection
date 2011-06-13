/**
 * extension.js
 * Copyright (C) 2011, Junta de Andalucía <devmaster@guadalinex.org>
 * 
 * This file is part of Guadalinex
 * 
 * This software is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 * 
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * As a special exception, if you link this library with other files to
 * produce an executable, this library does not by itself cause the
 * resulting executable to be covered by the GNU General Public License.
 * This exception does not however invalidate any other reasons why the
 * executable file might be covered by the GNU General Public License.
 * 
 * Authors:: Antonio Hernández (mailto:ahernandez@emergya.com)
 * 
 */

const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;

const St = imports.gi.St;
//const Mainloop = imports.mainloop;

const Main = imports.ui.main;
const Lang = imports.lang;
const BoxPointer = imports.ui.boxpointer;
const MessageTray = imports.ui.messageTray;
const LookingGlass = imports.ui.lookingGlass;
const PopupMenu = imports.ui.popupMenu;

const Side = {
    HIDDEN: 0,
    TOP: 1,
    RIGHT: 2,
    BOTTOM: 3,
    LEFT: 4
};

const ShellConf = {
    ACTIVATE_GECOS_SHELL: true,
    PANEL_SIDE: Side.BOTTOM,
    PANEL_CORNER_SIDE: Side.HIDDEN,
    HOT_CORNER_SIDE: Side.HIDDEN,
    MESSAGE_TRAY_SIDE: Side.TOP,
    UPDATE_STATUS_MENU: false
};

Logger = {
    error: function(msg) {
        return Main._log('[gs-reflection error]:', msg);
    },
    debug: function(msg) {
        return Main._log('[gs-reflection debug]:', msg);
    },
    notify: function(msg, details, isTransient) {
        isTransient = typeof(isTransient) == 'boolean' ? isTransient : true;
        let source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);
        let notification = new MessageTray.Notification(source, msg, details);
        notification.setTransient(isTransient);
        source.notify(notification);
    }
};

/**
 * Move the panel to the bottom of the screen.
 */
function updatePanel() {

    if (ShellConf.PANEL_SIDE != Side.BOTTOM)
        return;

    Main.panel.relayout = Lang.bind(Main.panel, function() {
    
        this.__proto__.relayout.call(this);
        
        let primary = global.get_primary_monitor();
        this.actor.set_position(primary.x, primary.y + primary.height - this.actor.height);
    });
    
    try {
        updateMenus();
    } catch(e) {
        Logger.error(e);
    }
    try {
        updatePanelCorner();
    } catch(e) {
        Logger.error(e);
    }
    try {
        updateLookingGlass();
    } catch(e) {
        Logger.error(e);
    }
}

/**
 * Move the panel corners to the bottom of the screen or hide them.
 */
function updatePanelCorner() {
        
    if (ShellConf.PANEL_CORNER_SIDE != Side.HIDDEN && ShellConf.PANEL_CORNER_SIDE != Side.BOTTOM)
        return;
    
    let relayout = null;
    
    if (ShellConf.PANEL_CORNER_SIDE == Side.HIDDEN) {
        
        relayout = function() {
            let node = this.actor.get_theme_node();

            let cornerRadius = node.get_length("-panel-corner-radius");
            let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');

            this.actor.set_size(cornerRadius, innerBorderWidth + cornerRadius);            
            this.actor.set_position(-Main.panel.actor.width, -Main.panel.actor.height);
        };
        
    } else if (ShellConf.PANEL_CORNER_SIDE == Side.BOTTOM) {

        relayout = Main.panel._leftCorner.relayout;

// Not implemented yet
//
//        relayout = function() {
//            let node = this.actor.get_theme_node();
//
//            let cornerRadius = node.get_length("-panel-corner-radius");
//            let innerBorderWidth = node.get_length('-panel-corner-inner-border-width');
//
//            this.actor.set_size(cornerRadius,
//                                innerBorderWidth + cornerRadius);
//            if (this._side == St.Side.LEFT)
//                this.actor.set_position(Main.panel.actor.x,
//                                        Main.panel.actor.y - Main.panel.actor.height - innerBorderWidth);
//            else
//                this.actor.set_position(Main.panel.actor.x + Main.panel.actor.width - cornerRadius,
//                                        Main.panel.actor.y - Main.panel.actor.height - innerBorderWidth);
//        };
    }
    
    Main.panel._leftCorner.relayout = Lang.bind(Main.panel._leftCorner, relayout);
    Main.panel._rightCorner.relayout = Lang.bind(Main.panel._rightCorner, relayout);
}

/**
 * Attach the LookingGlass to the messageTray so
 * it will stay on the top of the screen.
 */
function updateLookingGlass() {

    Main.lookingGlass = new LookingGlass.LookingGlass();
    Main.lookingGlass.slaveTo(Main.messageTray.actor.get_parent());
}

/**
 * Move the hot corners to the bottom of the screen
 * or hide them.
 */
function updateHotCorners() {

    function setHotCornerPosition(corner, monitor) {
    
        let cornerX = null;
        let cornerY = null;
        
        if (ShellConf.HOT_CORNER_SIDE == Side.BOTTOM) {
    
            // TODO: Currently the animated graphic is not shown.
            let pos = corner.actor.get_position();
            cornerX = pos[0];
            cornerY = pos[1] + monitor.height - 1;
            
        } else if (ShellConf.HOT_CORNER_SIDE == Side.HIDDEN) {
        
            cornerX = -1;
            cornerY = -1;
        }
        
        try {
            corner.actor.set_position(cornerX, cornerY);
        } catch(e) {
            Logger.error(e);
        }
    }
    
    let _relayout = Main._relayout;
    
    Main._relayout = (function(_relayout) {
        return function() {
        
            _relayout();
            
            // TODO: Currently only uses the primary monitor, need to create
            // a HotCorner in each monitor.
            let primary = global.get_primary_monitor();
    
            for (let i = 0, l = Main.hotCorners.length; i < l; i++) {
                let corner = Main.hotCorners[i];
                setHotCornerPosition(corner, primary);
//                Logger.debug("Monitor " + i + ": X = " + cornerX + ", Y = " + cornerY);
            }
        }
    })(_relayout);
}

/**
 * Make the menus open to top.
 */
function updateMenus() {

    // New menus inherits the new behavior.
    BoxPointer.BoxPointer.prototype._arrowSide = St.Side.BOTTOM;

    // Wait until all the indicators are loaded, so we can change all the menus.
    Main.panel.startStatusArea = Lang.bind(Main.panel, function() {
    
        this.__proto__.startStatusArea.call(this);

        this._menus._menus.forEach(function(menu) {
            menu.menu._boxPointer._arrowSide = St.Side.BOTTOM;
        });
    });
}

/**
 * Move the message tray to the top of the screen.
 */
function updateMessageTray() {

    if (ShellConf.MESSAGE_TRAY_SIDE != Side.TOP)
        return;

    Main.messageTray._setSizePosition = Lang.bind(Main.messageTray, function() {
    
        this.__proto__._setSizePosition.call(this);

        let primary = global.get_primary_monitor();
        this.actor.y = primary.y - this.actor.height + 1;
        
        this._pointerBarrier =
            global.create_pointer_barrier(primary.x + primary.width, primary.y + this.actor.height,
                                          primary.x + primary.width, primary.y,
                                           4 /* BarrierNegativeX */);
    });

    Main.messageTray._showTray = Lang.bind(Main.messageTray, function() {
    
        //this.__proto__._showTray.call(this);

        let State = MessageTray.State;
        let ANIMATION_TIME = MessageTray.ANIMATION_TIME;
        
        let primary = global.get_primary_monitor();
        this._tween(this.actor, '_trayState', State.SHOWN,
                    { y: primary.y,
                      time: ANIMATION_TIME,
                      transition: 'easeOutQuad'
                    });
    });

    Main.messageTray._hideTray = Lang.bind(Main.messageTray, function() {
    
        //this.__proto__._hideTray.call(this);
        
        let State = MessageTray.State;
        let ANIMATION_TIME = MessageTray.ANIMATION_TIME;
        
        let primary = global.get_primary_monitor();
        this._tween(this.actor, '_trayState', State.HIDDEN,
                    { y: primary.y - this.actor.height + 1,
                      time: ANIMATION_TIME,
                      transition: 'easeOutQuad'
                    });
    });
    
    // Notifications menu (SummaryItems)
    Main.messageTray._summaryBoxPointer._arrowSide = St.Side.TOP;

    Main.messageTray._setSizePosition();
}

/**
 * Debugging purposes.
 * @param label
 * @param callback
 */
function debugAddMenuItem(label, callback) {

    label = label || "Debug item..."
    callback = callback || function() {
        Logger.notify("404", "Nothing to notify", false);
    }
    
    let item = null;
    
    item = new PopupMenu.PopupSeparatorMenuItem();
    Main.panel._statusmenu.menu.addMenuItem(item);
    
    item = new PopupMenu.PopupMenuItem(_(label));
    item.connect('activate', Lang.bind(Main.panel._statusmenu, callback));
    Main.panel._statusmenu.menu.addMenuItem(item);
}

function main(extensionMeta) {

	/*
    Logger.debug("extensionMeta: ");
    for (let o in extensionMeta) {
        Logger.debug(o + ": " + extensionMeta[o]);
    }
    */

    if (!ShellConf.ACTIVATE_GECOS_SHELL)
        return;
    
    try {
        updatePanel();
    } catch(e) {
        Logger.error(e);
    }
    try {
        updateHotCorners();
    } catch(e) {
        Logger.error(e);
    }
    try {
        updateMessageTray();
    } catch(e) {
        Logger.error(e);
    }
}
