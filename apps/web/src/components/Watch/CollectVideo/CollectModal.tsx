import Alert from '@components/Common/Alert'
import AddressExplorerLink from '@components/Common/Links/AddressExplorerLink'
import { Button } from '@components/UIElements/Button'
import { Loader } from '@components/UIElements/Loader'
import Modal from '@components/UIElements/Modal'
import useAppStore from '@lib/store'
import usePersistStore from '@lib/store/persist'
import dayjs from 'dayjs'
import type { ApprovedAllowanceAmount, Publication } from 'lens'
import {
  CollectModules,
  useApprovedModuleAllowanceAmountQuery,
  usePublicationRevenueQuery
} from 'lens'
import type { Dispatch, FC } from 'react'
import React, { useEffect, useState } from 'react'
import type { LenstubeCollectModule } from 'utils'
import { Analytics, TRACK } from 'utils'
import { formatNumber } from 'utils/functions/formatNumber'
import { getRandomProfilePicture } from 'utils/functions/getRandomProfilePicture'
import imageCdn from 'utils/functions/imageCdn'
import { shortenAddress } from 'utils/functions/shortenAddress'
import { useBalance } from 'wagmi'

import BalanceAlert from './BalanceAlert'
import PermissionAlert from './PermissionAlert'

type Props = {
  showModal: boolean
  setShowModal: Dispatch<boolean>
  video: Publication
  collecting: boolean
  fetchingCollectModule: boolean
  collectModule: LenstubeCollectModule
  collectNow: () => void
}

const CollectModal: FC<Props> = ({
  showModal,
  setShowModal,
  video,
  collectNow,
  collecting,
  collectModule,
  fetchingCollectModule
}) => {
  const selectedChannel = useAppStore((state) => state.selectedChannel)
  const selectedChannelId = usePersistStore((state) => state.selectedChannelId)

  const [isAllowed, setIsAllowed] = useState(true)
  const [haveEnoughBalance, setHaveEnoughBalance] = useState(false)
  const isMembershipActive =
    video.profile?.followModule?.__typename === 'FeeFollowModuleSettings'
  const isFreeCollect =
    video.collectModule.__typename === 'FreeCollectModuleSettings'

  useEffect(() => {
    Analytics.track(TRACK.COLLECT.OPEN)
  }, [])

  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    address: selectedChannel?.ownedBy,
    token: collectModule?.amount?.asset?.address,
    formatUnits: collectModule?.amount?.asset?.decimals,
    watch: Boolean(collectModule?.amount),
    enabled: Boolean(collectModule?.amount)
  })

  const { data: revenueData } = usePublicationRevenueQuery({
    variables: {
      request: {
        publicationId: video?.id
      }
    },
    skip: !video?.id
  })

  const {
    loading: allowanceLoading,
    data: allowanceData,
    refetch: refetchAllowance
  } = useApprovedModuleAllowanceAmountQuery({
    variables: {
      request: {
        currencies: collectModule?.amount?.asset?.address,
        followModules: [],
        collectModules: [collectModule?.type],
        referenceModules: []
      }
    },
    skip: !collectModule?.amount?.asset?.address || !selectedChannelId,
    onCompleted: (data) => {
      setIsAllowed(data?.approvedModuleAllowanceAmount[0]?.allowance !== '0x00')
    }
  })

  useEffect(() => {
    if (
      balanceData &&
      collectModule?.amount &&
      parseFloat(balanceData?.formatted) <
        parseFloat(collectModule?.amount?.value)
    ) {
      setHaveEnoughBalance(false)
    } else {
      setHaveEnoughBalance(true)
    }
    if (collectModule?.amount?.asset?.address && selectedChannelId) {
      refetchAllowance()
    }
  }, [
    balanceData,
    collectModule,
    collectModule?.amount?.value,
    collectModule?.amount,
    refetchAllowance,
    selectedChannelId
  ])

  return (
    <Modal
      title="Collect Video"
      panelClassName="max-w-md"
      onClose={() => setShowModal(false)}
      show={showModal}
    >
      <div className="mt-4">
        {!fetchingCollectModule && !allowanceLoading ? (
          <>
            <div className="mb-3 flex flex-col">
              <span className="text-sm font-semibold">Total Collects</span>
              <span className="space-x-1">
                <span className="text-lg">
                  {formatNumber(video?.stats.totalAmountOfCollects)}
                  {collectModule?.collectLimit && (
                    <span> / {collectModule?.collectLimit}</span>
                  )}
                </span>
              </span>
            </div>
            {collectModule?.amount ? (
              <div className="mb-3 flex flex-col">
                <span className="text-sm font-semibold">Price</span>
                <span className="space-x-1">
                  <span className="text-2xl font-semibold">
                    {collectModule?.amount?.value}
                  </span>
                  <span>{collectModule?.amount?.asset.symbol}</span>
                </span>
              </div>
            ) : null}
            {collectModule?.endTimestamp ||
            collectModule?.optionalEndTimestamp ? (
              <div className="mb-3 flex flex-col">
                <span className="mb-0.5 text-sm font-semibold">Ends At</span>
                {collectModule.endTimestamp && (
                  <span className="text-lg">
                    {dayjs(collectModule.endTimestamp).format('MMMM DD, YYYY')}{' '}
                    at {dayjs(collectModule.endTimestamp).format('hh:mm a')}
                  </span>
                )}
                {collectModule.optionalEndTimestamp && (
                  <span className="text-lg">
                    {dayjs(collectModule.optionalEndTimestamp).format(
                      'MMMM DD, YYYY'
                    )}{' '}
                    at{' '}
                    {dayjs(collectModule.optionalEndTimestamp).format(
                      'hh:mm a'
                    )}
                  </span>
                )}
              </div>
            ) : null}
            {revenueData?.publicationRevenue ? (
              <div className="mb-3 flex flex-col">
                <span className="text-sm font-semibold">Revenue</span>
                <span className="space-x-1">
                  <span className="text-2xl font-semibold">
                    {revenueData?.publicationRevenue?.revenue?.total?.value ??
                      0}
                  </span>
                  <span>{collectModule?.amount?.asset.symbol}</span>
                </span>
              </div>
            ) : null}
            {collectModule?.referralFee ? (
              <div className="mb-3 flex flex-col">
                <span className="mb-0.5 text-sm font-semibold">
                  Referral Fee
                </span>
                <span className="text-lg">{collectModule.referralFee} %</span>
              </div>
            ) : null}
            {collectModule?.recipient || collectModule.recipients ? (
              <div className="mb-3 flex flex-col">
                <span className="mb-0.5 text-sm font-semibold">
                  Revenue
                  {collectModule.recipients ? ' Recipients' : ' Recipient'}
                </span>
                {collectModule.recipient && (
                  <AddressExplorerLink address={collectModule?.recipient}>
                    <span className="text-lg">
                      {shortenAddress(collectModule?.recipient)}
                    </span>
                  </AddressExplorerLink>
                )}
                {collectModule.type ===
                  CollectModules.MultirecipientFeeCollectModule &&
                  collectModule.recipients.length && (
                    <div>
                      {collectModule.recipients.map((splitRecipient) => (
                        <AddressExplorerLink
                          key={splitRecipient.recipient}
                          address={splitRecipient?.recipient}
                        >
                          <div className="flex items-center space-x-2 py-1 text-sm">
                            <img
                              className="h-4 w-4 rounded-full"
                              src={imageCdn(
                                getRandomProfilePicture(
                                  splitRecipient.recipient
                                ),
                                'avatar'
                              )}
                              alt=""
                            />
                            <span>{splitRecipient?.recipient}</span>
                          </div>
                        </AddressExplorerLink>
                      ))}
                    </div>
                  )}
              </div>
            ) : null}
            <div className="flex justify-end space-x-2">
              {isAllowed ? (
                collectModule?.followerOnly && !video.profile.isFollowedByMe ? (
                  <div className="flex-1">
                    <Alert variant="warning">
                      <div className="flex px-2">
                        Only {isMembershipActive ? 'Members' : 'Subscribers'}{' '}
                        can collect this publication
                      </div>
                    </Alert>
                  </div>
                ) : balanceLoading && !haveEnoughBalance ? (
                  <div className="flex w-full justify-center py-2">
                    <Loader />
                  </div>
                ) : haveEnoughBalance ? (
                  <Button disabled={collecting} onClick={() => collectNow()}>
                    {isFreeCollect ? 'Collect for free' : 'Collect Now'}
                  </Button>
                ) : (
                  <BalanceAlert collectModule={collectModule} />
                )
              ) : (
                <PermissionAlert
                  isAllowed={isAllowed}
                  setIsAllowed={setIsAllowed}
                  allowanceModule={
                    allowanceData
                      ?.approvedModuleAllowanceAmount[0] as ApprovedAllowanceAmount
                  }
                />
              )}
            </div>
          </>
        ) : (
          <div className="py-6">
            <Loader />
          </div>
        )}
      </div>
    </Modal>
  )
}

export default CollectModal
