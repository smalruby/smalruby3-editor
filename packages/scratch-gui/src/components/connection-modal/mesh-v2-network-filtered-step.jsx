// === Smalruby: This file is Smalruby-specific (MeshV2 network filter detection) ===
// This component is specific to meshV2 extension and displays an error message
// when the extension is blocked by network filter (HTTP 503) such as i-Filter proxy
// in schools or enterprises.
import classNames from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'
import { FormattedMessage } from 'react-intl'
import Box from '../box/box.jsx'
import styles from './connection-modal.css'
import Dots from './dots.jsx'
import backIcon from './icons/back.svg'
import copyIcon from './icons/copy.svg'

const MeshV2NetworkFilteredStep = props => {
  const [copied, setCopied] = React.useState(false)

  const networkInfoMessage = `スモウルビーのメッシュ機能を使うため、ネットワークの制限を解除してください。

利用するネットワークの情報
プロトコル: https, wss (WebSocket)
ホスト: api.smalruby.app, graphql.api.smalruby.app
URL: https://graphql.api.smalruby.app/, wss://graphql.api.smalruby.app/`

  const handleCopy = React.useCallback(() => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(networkInfoMessage)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => {
          // Silently fail - user can manually copy
        })
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = networkInfoMessage
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (e) {
        // Silently fail - user can manually copy
      }
      document.body.removeChild(textArea)
    }
  }, [networkInfoMessage])

  return (
    <Box className={styles.body}>
      <Box className={styles.bottomArea}>
        <div className={classNames(styles.bottomAreaItem, styles.instructions)}>
          <FormattedMessage
            defaultMessage={
              'The new mesh feature is unavailable.{br}' +
              'Please ask your network administrator to remove the restriction.'
            }
            description="Message when mesh v2 is blocked by network filter"
            id="gui.connection.networkFiltered.message"
            values={{
              br: <br />,
            }}
          />
        </div>
        <div className={classNames(styles.bottomAreaItem, styles.networkInfo)}>
          <pre className={styles.networkInfoText}>{networkInfoMessage}</pre>
          <button className={styles.copyButton} onClick={handleCopy}>
            <img className={styles.buttonIconLeft} src={copyIcon} />
            {copied ? (
              <FormattedMessage
                defaultMessage="Copied!"
                description="Message shown after copying to clipboard"
                id="gui.connection.networkFiltered.copied"
              />
            ) : (
              <FormattedMessage
                defaultMessage="Copy to clipboard"
                description="Button to copy network info to clipboard"
                id="gui.connection.networkFiltered.copyButton"
              />
            )}
          </button>
        </div>
        <Dots error className={styles.bottomAreaItem} total={3} />
        <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
          <button className={styles.connectionButton} onClick={props.onScanning}>
            <img className={classNames(styles.buttonIconLeft, styles.buttonIconBack)} src={backIcon} />
            <FormattedMessage
              defaultMessage="Try again"
              description="Button to retry connection"
              id="gui.connection.networkFiltered.tryagainbutton"
            />
          </button>
          <button className={styles.connectionButton} onClick={props.onUseLegacyMesh}>
            <FormattedMessage
              defaultMessage="Use legacy mesh"
              description="Button to use legacy mesh extension"
              id="gui.connection.networkFiltered.useLegacyMeshButton"
            />
          </button>
        </Box>
      </Box>
    </Box>
  )
}

MeshV2NetworkFilteredStep.propTypes = {
  onScanning: PropTypes.func,
  onUseLegacyMesh: PropTypes.func,
}

export default MeshV2NetworkFilteredStep
