# Computer Use Touchpad

English | [한국어](README.ko.md)

A control page and noVNC input extension that add touchpad controls to an existing computer-use environment. Supports relative cursor movement, tap to left-click, two-finger scrolling, and separate left- and right-click buttons.

## Runtime setup

- Control page: HTTP port 8088
- noVNC: HTTP port 6080
- Remote desktop: the VNC server in the existing computer-use container

| File | Purpose | Runtime location |
| --- | --- | --- |
| `index.html` | Tool menu, input modes, screen control, and external touchpad | `index.html` in the computer-use installation directory |
| `touchpad.js` | Converts external touchpad commands into noVNC mouse and wheel input | `/opt/noVNC/app/touchpad.js` inside the container |

These files run within an existing computer-use environment. Its Docker image, Chrome profile, and VNC server are managed separately.

## Usage

The current interface uses Korean labels.

1. Open the control page and select touchpad mode (`입력: 터치패드`).
2. Enable screen control (`화면 제어 켜기`).
3. Swipe on the pad to move the cursor. Use two fingers to scroll.
4. Tap without moving to left-click at the current cursor position. A press longer than 500 ms or a gesture with movement does not trigger a click.
5. You can also use the left-click (`좌클릭`) and right-click (`우클릭`) buttons below the pad.

The pad sends no input when screen control is disabled or noVNC is in view-only mode. Touch mode uses noVNC's existing direct screen controls.

## Applying changes and restoring a backup

1. Compare the running files with this repository. Check the target container and its volume mounts.
2. Back up the existing files in the runtime environment.
3. Copy `index.html` over the existing file. The current environment uses a single-file bind mount; after copying, confirm that the host file, container-mounted file, and HTTP response have matching SHA-256 hashes.
4. When changing `touchpad.js`, update both the running container and the source used for the next image build. The existing Dockerfile copies this file to `/opt/noVNC/app/touchpad.js` and registers the module in `vnc.html`. Update the module URL's cache version when its contents change.
5. Reload the control page and check screen control, cursor movement, clicks, and scrolling.
6. If a problem occurs, restore the backup and repeat the hash and input checks.

The current environment also calls `_saveExpectedClientSize()` after noVNC's resize handling. Check this compatibility adjustment when updating noVNC itself.

## Input verification

- Test pad input using real Chromium touch events.
- Intercept outgoing RFB pointer packets in the QA browser to avoid controlling the shared remote desktop.
- Check that movement does not click, two-finger scrolling works, canceled gestures send no click, disabled controls send no input, both click buttons work, and mouse capture is released.
- Check touch sensitivity separately on a physical phone.

The live verification results from the tap-to-click change on 2026-11-03 are recorded in [the verification report](verification/2026-11-03-tap-click.json). Source hashes and JavaScript syntax were checked when importing the files into this repository.

## History baseline

The first commit imports the Oracle control page backup from immediately before the tap-to-click change on 2026-11-03, along with the input extension from the same environment. Earlier work is not reconstructed as backdated Git commits.
