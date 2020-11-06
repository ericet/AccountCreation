blurt.api.setOptions({ url: "https://rpc.blurt.buzz", useAppbaseApi: true })
const DEFAULT_CREATION_FEE = "10.000 BLURT"
// Checking if the already exists
async function checkAccountName(username) {
  const [ac] = await blurt.api.getAccountsAsync([username]);
  return (ac === undefined) ? true : false;
}

// Generates Aall Private Keys from username and password
function getPrivateKeys(username, password, roles = ['owner', 'active', 'posting', 'memo']) {
  const privKeys = {};
  roles.forEach((role) => {
    privKeys[role] = dsteem.PrivateKey.fromLogin(username, password, role).toString();
    privKeys[`${role}Pubkey`] = dsteem.PrivateKey.from(privKeys[role]).createPublic().toString();
  });

  return privKeys;
};

// Creates a suggested password
function suggestPassword() {
  const array = new Uint32Array(10);
  window.crypto.getRandomValues(array);
  return 'P' + dsteem.PrivateKey.fromSeed(array).toString();
}

function getAccountCreationFee() {
  return new Promise(function (resolve) {
    blurt.api.getChainProperties(function (err, result) {
      if (!err && result) {
        resolve(result.account_creation_fee);
      } else {
        resolve(DEFAULT_CREATION_FEE);
      }
    });
  });
}

$(document).ready(async function () {
  let creationFee = await getAccountCreationFee();
  $('#fee-message').html(`Enter the BLURT account who will be paying the <b>${creationFee}</b> account creation fee.`);
  // Check if the name is available
  $('#new-account').on('input', async function () {
    let letterNumber = /^[a-z0-9]+(\.|\-)?[a-z0-9]{3,}$/;
    let username = $(this).val().toLowerCase();
    if (username.length >= 3 && username.match(letterNumber) && username.length < 16) {
      try {
        const ac = await checkAccountName(username, 'blurt');
        (!ac) ? $(this).removeClass('is-valid').addClass('is-invalid') : $(this).removeClass('is-invalid').addClass('is-valid');
      } catch (e) {
        console.log(e)
      }
    }
  });

  // Auto fills password field
  $('#password').val(suggestPassword());

  // Download keys
  $('#download-password').click(function (e) {
    e.preventDefault();
    const username = $('#new-account').val().toLowerCase();
    const password = $('#password').val();

    const keys = getPrivateKeys(username, password);

    const text = `Username: ${username}\nMaster password: ${password}\nOwner key: ${keys.owner}\nActive key: ${keys.active}\nPosting key: ${keys.posting}\nMemo key: ${keys.memo}`;

    var file = new File([text], `${username}-backup.txt`, { type: "text/plain;charset=utf-8" });
    saveAs(file);
});


  // Processing create account form
  $('#create-account').submit(async function (e) {
    e.preventDefault();

    const username = $('#new-account').val().toLowerCase();
    const password = $('#password').val();
    const creator = $('#creator').val().toLowerCase();
    const transfer = parseFloat($('#transfer').val()).toFixed(3);
    const active = $('#creator-key').val();
    const feedback = $('#create-account-feedback');

    const ops = [];

    let keys = blurt.auth.generateKeys(username, password, ['owner', 'active', 'posting', 'memo']);
    var owner = { weight_threshold: 1, account_auths: [], key_auths: [[keys.owner, 1]] };
    var activeKey = { weight_threshold: 1, account_auths: [], key_auths: [[keys.active, 1]] };
    var posting = { weight_threshold: 1, account_auths: [], key_auths: [[keys.posting, 1]] };

    const create_op = [
      'account_create',
      {
        active: activeKey,
        creator,
        extensions: [],
        fee: "10.000 BLURT",
        json_metadata: '',
        memo_key: keys.memo,
        new_account_name: username,
        owner,
        posting,
      },
    ];

    ops.push(create_op);

    if (transfer > 0) {
      const gift_op = ['transfer', {
        from: creator,
        to: username,
        amount: transfer + " BLURT",
        memo: ''
      }];
      ops.push(gift_op);
    }

    feedback.removeClass('alert-success').removeClass('alert-danger');

    if (window.blurt_keychain && active === '') {
      blurt_keychain.requestBroadcast(creator, ops, 'active', function (response) {
        console.log(response);
        if (response.success) feedback.addClass('alert-success').text('Account: ' + username + ' has been created successfully.');
      });

    }
    else if (active === '') {
      feedback.addClass('alert-danger').text(`Please enter ${creator}'s PRIVATE ACTIVE KEY`);
    }
    else {
      blurt.broadcast.send(
        { operations: ops, extensions: [] },
        { active: active },
        function (err, result) {
          if (!err && result) {
            console.log(result);
            feedback.addClass('alert-success').text('Account: ' + username + ' has been created successfully.');
          } else {
            console.log(e);
            feedback.addClass('alert-danger').text(e.message);
          }

        });
    }
  });
});