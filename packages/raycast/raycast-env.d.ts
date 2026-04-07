/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `start` command */
  export type Start = ExtensionPreferences & {}
  /** Preferences accessible in the `stop` command */
  export type Stop = ExtensionPreferences & {}
  /** Preferences accessible in the `last` command */
  export type Last = ExtensionPreferences & {}
  /** Preferences accessible in the `memo` command */
  export type Memo = ExtensionPreferences & {}
  /** Preferences accessible in the `status` command */
  export type Status = ExtensionPreferences & {}
  /** Preferences accessible in the `menu-bar` command */
  export type MenuBar = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `start` command */
  export type Start = {}
  /** Arguments passed to the `stop` command */
  export type Stop = {}
  /** Arguments passed to the `last` command */
  export type Last = {}
  /** Arguments passed to the `memo` command */
  export type Memo = {}
  /** Arguments passed to the `status` command */
  export type Status = {}
  /** Arguments passed to the `menu-bar` command */
  export type MenuBar = {}
}

